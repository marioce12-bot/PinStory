import crypto from "node:crypto";

export function getAccountId(email: string) {
  return Buffer.from(email.trim().toLowerCase()).toString("base64url");
}

export function hashAccountSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function isValidAccountSecret(secret: string) {
  return secret.trim().length >= 4;
}
