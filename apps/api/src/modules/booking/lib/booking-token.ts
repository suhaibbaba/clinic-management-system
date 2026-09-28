export const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

export const decode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");
