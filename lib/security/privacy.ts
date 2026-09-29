import { createHash, randomBytes } from "node:crypto";

export const ANONYMOUS_SESSION_COOKIE = "anon_search_session";

export function hashAnonymousSession(sessionId: string) {
  const salt = process.env.SEARCH_LOG_HASH_SALT;

  if (!salt) {
    throw new Error("SEARCH_LOG_HASH_SALT is required for anonymous search logging.");
  }

  return createHash("sha256")
    .update(`${salt}:${sessionId}`)
    .digest("hex");
}

export function newAnonymousSessionId() {
  return randomBytes(32).toString("base64url");
}

export const FCRA_DISCLAIMER =
  "This service is not a Consumer Reporting Agency and may not be used for credit, employment, housing, or tenant screening.";
