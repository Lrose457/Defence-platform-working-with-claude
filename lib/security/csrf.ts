import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * A cryptographically random token is generated in the middleware and
 * stored in an httpOnly, SameSite=Strict, Secure cookie.  The same
 * token is embedded in the page via a `<meta>` tag so that client-side
 * JavaScript can read it and echo it back in the `X-CSRF-Token` header
 * on state-changing (POST / PUT / DELETE / PATCH) requests.
 *
 * The server validates that the header value matches the cookie value.
 * Because the cookie is SameSite=Strict, a cross-site attacker cannot
 * read the cookie or send it with a cross-site request, and a forged
 * header without the matching cookie value is rejected.
 */

export const CSRF_COOKIE_NAME = "_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Set the CSRF cookie from the middleware (where we have access to the
 * NextResponse object).  The cookie is httpOnly, SameSite=Strict, and
 * Secure.
 */
export function setCsrfCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 60 * 60, // 60 minutes
  });
}

/**
 * Read the CSRF token from the cookie store (used in Server Components
 * such as the root layout to embed the token in a <meta> tag).
 */
export async function getCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value ?? null;
}

/**
 * Read the CSRF token from a raw Request's cookie header (used in API
 * routes and middleware).
 */
export function getCookieCsrfToken(request: Request): string | null {
  const cookiesList = request.headers.get("cookie");
  if (!cookiesList) return null;

  const match = cookiesList.match(
    new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Validate that the `X-CSRF-Token` header matches the CSRF cookie value.
 *
 * Returns `true` if the tokens match, `false` otherwise.
 * For server-to-server calls that bypass the browser, pass `bearer` in
 * the `Authorization` header instead — see `validateBearerToken`.
 */
export function validateCsrfToken(request: Request): boolean {
  const cookieToken = getCookieCsrfToken(request);
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) return false;

  /*
   * Constant-time comparison to prevent timing attacks.
   */
  const cookieHash = createHash("sha256")
    .update(cookieToken)
    .digest("hex");
  const headerHash = createHash("sha256")
    .update(headerToken)
    .digest("hex");

  if (cookieHash.length !== headerHash.length) return false;

  let diff = 0;
  for (let i = 0; i < cookieHash.length; i++) {
    diff |= cookieHash.charCodeAt(i) ^ headerHash.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Verify a Bearer token for server-to-server API calls (data pipeline,
 * cron jobs).  Reads `BSS_API_TOKEN` from the environment.
 */
export function validateBearerToken(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.BSS_API_TOKEN;

  if (!auth?.startsWith("Bearer ") || !expected) return false;

  const provided = auth.slice(7);
  const providedHash = createHash("sha256").update(provided).digest("hex");
  const expectedHash = createHash("sha256")
    .update(expected)
    .digest("hex");

  if (providedHash.length !== expectedHash.length) return false;

  let diff = 0;
  for (let i = 0; i < providedHash.length; i++) {
    diff |= providedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Apply CSRF validation to a write request (POST, PUT, DELETE, PATCH).
 *
 * Either a valid CSRF token pair or a valid bearer token is accepted.
 * Returns `null` on success, or a NextResponse with a 403 status on
 * failure.
 */
export function requireCsrfOrBearer(
  request: Request,
): NextResponse | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null;
  }

  if (validateCsrfToken(request) || validateBearerToken(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "CSRF validation failed. Provide a valid X-CSRF-Token header or bearer token." },
    { status: 403 },
  );
}
