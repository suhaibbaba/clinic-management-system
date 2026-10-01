import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { and, count, desc, eq, gt, isNull, lt } from "drizzle-orm";
import {
  AUTH_ERROR,
  type Passkey,
  type PasskeyChallenge,
  type RegisterPasskeyInput,
  type VerifyPasskeyLoginInput,
} from "@clinic/shared";
import { type Env } from "@api/config/env.schema";
import { DATABASE, type Database } from "@api/database/database.module";
import { authChallenges, clinics, passkeys, users } from "@api/database/schema";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  AUTH_CHALLENGE_PURPOSE,
  AUTH_CHALLENGE_TTL_MINUTES,
  PASSKEYS_PER_USER,
} from "@api/modules/auth/constants";
import { type UserRow } from "@api/modules/auth/lib/auth";
import { relyingParty, toPasskey, type RelyingParty } from "@api/modules/auth/lib/webauthn";

type ChallengePurpose = (typeof AUTH_CHALLENGE_PURPOSE)[keyof typeof AUTH_CHALLENGE_PURPOSE];

@Injectable()
export class PasskeyService {
  private readonly rp: RelyingParty;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.rp = relyingParty(
      config.get("PUBLIC_BASE_URL", { infer: true }),
      config.get("WEBAUTHN_RP_ID", { infer: true }),
      config.get("WEBAUTHN_ORIGIN", { infer: true }),
    );
  }

  async loginOptions(): Promise<PasskeyChallenge<PublicKeyCredentialRequestOptionsJSON>> {
    const options = await generateAuthenticationOptions({
      rpID: this.rp.id,
      userVerification: "preferred",
    });

    return {
      challengeId: await this.storeChallenge(
        AUTH_CHALLENGE_PURPOSE.PASSKEY_LOGIN,
        options.challenge,
        null,
      ),
      options,
    };
  }

  async authenticate(input: VerifyPasskeyLoginInput): Promise<UserRow | undefined> {
    const challenge = await this.takeChallenge(
      input.challengeId,
      AUTH_CHALLENGE_PURPOSE.PASSKEY_LOGIN,
      null,
    );

    if (!challenge) {
      return undefined;
    }

    const [found] = await this.db
      .select({ passkey: passkeys, user: users })
      .from(passkeys)
      .innerJoin(users, eq(users.id, passkeys.userId))
      .where(and(eq(passkeys.credentialId, input.response.id), isNull(users.deletedAt)))
      .limit(1);

    if (!found) {
      return undefined;
    }

    let newCounter: number;

    try {
      const result = await verifyAuthenticationResponse({
        response: input.response as unknown as AuthenticationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: this.rp.origins,
        expectedRPID: this.rp.id,
        credential: {
          id: found.passkey.credentialId,
          publicKey: Buffer.from(found.passkey.publicKey, "base64url"),
          counter: found.passkey.counter,
          transports: found.passkey.transports,
        },
        requireUserVerification: false,
      });

      if (!result.verified) {
        return undefined;
      }

      newCounter = result.authenticationInfo.newCounter;
    } catch {
      return undefined;
    }

    await this.db
      .update(passkeys)
      .set({ counter: newCounter, lastUsedAt: new Date() })
      .where(eq(passkeys.id, found.passkey.id));

    return found.user;
  }

  async registrationOptions(
    actor: AuthenticatedUser,
  ): Promise<PasskeyChallenge<PublicKeyCredentialCreationOptionsJSON>> {
    const [owner] = await this.db
      .select({ user: users, clinicNameAr: clinics.nameAr, clinicNameEn: clinics.nameEn })
      .from(users)
      .innerJoin(clinics, eq(clinics.id, users.clinicId))
      .where(and(eq(users.id, actor.id), eq(users.clinicId, actor.clinicId)))
      .limit(1);

    if (!owner) {
      throw new NotFoundException();
    }

    const existing = await this.db
      .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
      .from(passkeys)
      .where(eq(passkeys.userId, actor.id));

    const options = await generateRegistrationOptions({
      rpName: owner.clinicNameEn || owner.clinicNameAr,
      rpID: this.rp.id,
      userID: new TextEncoder().encode(owner.user.id),
      userName: owner.user.email ?? owner.user.phone,
      userDisplayName: owner.user.nameEn || owner.user.nameAr,
      attestationType: "none",
      excludeCredentials: existing.map((row) => ({
        id: row.credentialId,
        transports: row.transports,
      })),
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });

    return {
      challengeId: await this.storeChallenge(
        AUTH_CHALLENGE_PURPOSE.PASSKEY_REGISTER,
        options.challenge,
        actor.id,
      ),
      options,
    };
  }

  async register(actor: AuthenticatedUser, input: RegisterPasskeyInput): Promise<Passkey> {
    const [held] = await this.db
      .select({ total: count() })
      .from(passkeys)
      .where(eq(passkeys.userId, actor.id));

    if ((held?.total ?? 0) >= PASSKEYS_PER_USER) {
      throw new ConflictException(AUTH_ERROR.PASSKEY_INVALID);
    }

    const challenge = await this.takeChallenge(
      input.challengeId,
      AUTH_CHALLENGE_PURPOSE.PASSKEY_REGISTER,
      actor.id,
    );

    if (!challenge) {
      throw new BadRequestException(AUTH_ERROR.PASSKEY_INVALID);
    }

    let credential: { id: string; publicKey: Uint8Array; counter: number; transports: string[] };

    try {
      const result = await verifyRegistrationResponse({
        response: input.response as unknown as RegistrationResponseJSON,
        expectedChallenge: challenge,
        expectedOrigin: this.rp.origins,
        expectedRPID: this.rp.id,
        requireUserVerification: false,
      });

      if (!result.verified) {
        throw new BadRequestException(AUTH_ERROR.PASSKEY_INVALID);
      }

      const { id, publicKey, counter, transports } = result.registrationInfo.credential;
      credential = { id, publicKey, counter, transports: transports ?? [] };
    } catch {
      throw new BadRequestException(AUTH_ERROR.PASSKEY_INVALID);
    }

    const [row] = await this.db
      .insert(passkeys)
      .values({
        clinicId: actor.clinicId,
        userId: actor.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports,
        name: input.name,
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      throw new ConflictException(AUTH_ERROR.PASSKEY_INVALID);
    }

    return toPasskey(row);
  }

  async list(actor: AuthenticatedUser): Promise<Passkey[]> {
    const rows = await this.db
      .select()
      .from(passkeys)
      .where(and(eq(passkeys.userId, actor.id), eq(passkeys.clinicId, actor.clinicId)))
      .orderBy(desc(passkeys.createdAt));

    return rows.map(toPasskey);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const removed = await this.db
      .delete(passkeys)
      .where(
        and(
          eq(passkeys.id, id),
          eq(passkeys.userId, actor.id),
          eq(passkeys.clinicId, actor.clinicId),
        ),
      )
      .returning({ id: passkeys.id });

    if (removed.length === 0) {
      throw new NotFoundException();
    }
  }

  private async storeChallenge(
    purpose: ChallengePurpose,
    challenge: string,
    userId: string | null,
  ): Promise<string> {
    await this.db.delete(authChallenges).where(lt(authChallenges.expiresAt, new Date()));

    const [row] = await this.db
      .insert(authChallenges)
      .values({
        purpose,
        challenge,
        userId,
        expiresAt: new Date(Date.now() + AUTH_CHALLENGE_TTL_MINUTES * 60_000),
      })
      .returning({ id: authChallenges.id });

    if (!row) {
      throw new Error("Could not store the passkey challenge");
    }

    return row.id;
  }

  private async takeChallenge(
    id: string,
    purpose: ChallengePurpose,
    userId: string | null,
  ): Promise<string | undefined> {
    const [row] = await this.db
      .delete(authChallenges)
      .where(
        and(
          eq(authChallenges.id, id),
          eq(authChallenges.purpose, purpose),
          userId === null ? isNull(authChallenges.userId) : eq(authChallenges.userId, userId),
          gt(authChallenges.expiresAt, new Date()),
        ),
      )
      .returning({ challenge: authChallenges.challenge });

    return row?.challenge;
  }
}
