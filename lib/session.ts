import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "trialguard_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  login: string;
  issuedAt: number;
  expiresAt: number;
};

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 UTF-8 bytes");
  }
  return secret;
}

function signature(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSession(login: string, now = Date.now()): string {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) {
    throw new TypeError("Invalid GitHub login");
  }
  const payload: SessionPayload = {
    login,
    issuedAt: Math.floor(now / 1000),
    expiresAt: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return encoded + "." + signature(encoded);
}

export function verifySession(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const expected = Buffer.from(signature(parts[0]), "base64url");
    const supplied = Buffer.from(parts[1], "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as SessionPayload;
    const nowSeconds = Math.floor(now / 1000);
    if (
      !payload ||
      typeof payload.login !== "string" ||
      !/^[A-Za-z0-9-]{1,39}$/.test(payload.login) ||
      !Number.isInteger(payload.issuedAt) ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= nowSeconds ||
      payload.issuedAt > nowSeconds + 60
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
