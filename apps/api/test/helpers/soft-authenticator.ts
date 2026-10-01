import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";

type Cbor = number | string | Buffer | Cbor[] | Map<Cbor, Cbor>;

function head(major: number, length: number): Buffer {
  if (length < 24) {
    return Buffer.from([(major << 5) | length]);
  }

  if (length < 0x100) {
    return Buffer.from([(major << 5) | 24, length]);
  }

  const out = Buffer.alloc(3);
  out[0] = (major << 5) | 25;
  out.writeUInt16BE(length, 1);

  return out;
}

function cbor(value: Cbor): Buffer {
  if (typeof value === "number") {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }

  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, bytes.length), bytes]);
  }

  if (Buffer.isBuffer(value)) {
    return Buffer.concat([head(2, value.length), value]);
  }

  if (Array.isArray(value)) {
    return Buffer.concat([head(4, value.length), ...value.map(cbor)]);
  }

  return Buffer.concat([
    head(5, value.size),
    ...[...value].flatMap(([key, entry]) => [cbor(key), cbor(entry)]),
  ]);
}

const sha256 = (data: Buffer | string): Buffer => createHash("sha256").update(data).digest();

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED = 0x40;

export interface SoftAuthenticatorOptions {
  readonly rpId?: string;
  readonly origin?: string;
}

export class SoftAuthenticator {
  readonly credentialId = randomBytes(32);

  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private counter = 0;
  private readonly rpId: string;
  private readonly origin: string;

  constructor(options: SoftAuthenticatorOptions = {}) {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
    this.rpId = options.rpId ?? "localhost";
    this.origin = options.origin ?? "http://localhost:5173";
  }

  get id(): string {
    return this.credentialId.toString("base64url");
  }

  register(challenge: string, origin: string = this.origin): Record<string, unknown> {
    const jwk = this.publicKey.export({ format: "jwk" });
    const coseKey = cbor(
      new Map<Cbor, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x ?? "", "base64url")],
        [-3, Buffer.from(jwk.y ?? "", "base64url")],
      ]),
    );
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(this.credentialId.length);

    const authData = Buffer.concat([
      this.header(FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED),
      Buffer.alloc(16),
      idLength,
      this.credentialId,
      coseKey,
    ]);
    const attestationObject = cbor(
      new Map<Cbor, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );

    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: this.clientData("webauthn.create", challenge, origin).toString("base64url"),
        attestationObject: attestationObject.toString("base64url"),
        transports: ["internal"],
      },
    };
  }

  assert(
    challenge: string,
    options: { origin?: string; signWith?: SoftAuthenticator } = {},
  ): Record<string, unknown> {
    const authData = this.header(FLAG_USER_PRESENT | FLAG_USER_VERIFIED);
    const clientData = this.clientData("webauthn.get", challenge, options.origin ?? this.origin);
    const signer = options.signWith?.privateKey ?? this.privateKey;

    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientData.toString("base64url"),
        authenticatorData: authData.toString("base64url"),
        signature: sign("sha256", Buffer.concat([authData, sha256(clientData)]), signer).toString(
          "base64url",
        ),
      },
    };
  }

  private header(flags: number): Buffer {
    this.counter += 1;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(this.counter);

    return Buffer.concat([sha256(this.rpId), Buffer.from([flags]), counter]);
  }

  private clientData(type: string, challenge: string, origin: string): Buffer {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }
}
