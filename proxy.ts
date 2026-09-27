import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { rateLimitDb } from "@/lib/security/rateLimitDb";
import { CSRF_COOKIE_NAME, generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";

const IS_PROD = process.env.NODE_ENV === "production";

/*
 * Network boundary: nonce-based Content Security Policy. (This is Next.js
 * 16's renamed middleware convention — the file lives at the project root.)
 *
 * In production, scripts must carry a per-request nonce (Next.js reads the
 * CSP header from the request and automatically applies the nonce to its
 * inline bootstrap/hydration scripts). `strict-dynamic` then lets trusted
 * scripts load chunks. No `unsafe-inline` / `unsafe-eval` in production.
 *
 * In development, React Fast Refresh and the dev overlay require eval and
 * inline scripts, so a relaxed CSP is used. This branch never ships.
 */
function buildCsp(nonce: string): string {
  const scriptSrc = IS_PROD
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-inline' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://raw.githubusercontent.com",
    "frame-src 'self' https://checkout.stripe.com https://js.stripe.com",
    "upgrade-insecure-requests",
  ].join("; ");
}

function getNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function applySecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

function json429(retryAfter: number, csp: string) {
  return applySecurityHeaders(
    NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    ),
    csp,
  );
}

async function getUserRole(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["analyst", "admin"])
    .maybeSingle();

  return data?.role ?? null;
}

export async function proxy(request: NextRequest) {
  const nonce = getNonce();
  const csp = buildCsp(nonce);
  const pathname = request.nextUrl.pathname;

  const isSensitiveEndpoint =
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/billing/checkout") ||
    pathname.startsWith("/account/login") ||
    pathname.startsWith("/account/signup");

  if (isSensitiveEndpoint) {
    /*
     * Fast in-memory circuit breaker (per-instance).
     */
    const fastLimit = rateLimit(
      `${requestKey(request)}:${pathname}`,
      pathname.startsWith("/api/search") ? 30 : 10,
    );

    if (!fastLimit.allowed) {
      return json429(fastLimit.retryAfter, csp);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  /*
   * Setting the CSP on the request headers is what enables Next.js to
   * automatically apply the nonce to its own inline <script> tags.
   */
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "strict",
              secure: true,
              path: "/",
            });
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();

  /*
   * Distributed rate-limit check (across serverless instances).
   * Only applies to sensitive endpoints; the in-memory circuit
   * breaker above already handled the fast path.
   * These endpoints require the database anyway, so failing closed
   * is correct: no DB, no service.
   */
  if (isSensitiveEndpoint) {
    const dbLimit = await rateLimitDb(
      supabase,
      `${requestKey(request)}:${pathname}`,
      pathname.startsWith("/api/search") ? 30 : 10,
      undefined,
      { failClosed: true },
    );

    if (!dbLimit.allowed) {
      return json429(dbLimit.retryAfter, csp);
    }
  }

  /*
   * Ensure a CSRF cookie is present for state-changing requests.
   * The cookie is httpOnly; the token is also embedded in the page
   * via a <meta> tag so client-side JS can echo it back in the
   * X-CSRF-Token header.
   */
  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    const csrfToken = generateCsrfToken();
    setCsrfCookie(response, csrfToken);
  }

  /*
   * Role-based route enforcement.
   *
   * Admin pages require an analyst (or admin) role. Unauthenticated
   * visitors are redirected to the login page; authenticated users
   * without the right role get bounced to their account page.
   */
  if (pathname.startsWith("/admin")) {
    const role = await getUserRole(supabase);

    if (!role) {
      const url = request.nextUrl.clone();
      url.pathname = "/account/login";
      url.searchParams.set("redirectTo", pathname);
      return applySecurityHeaders(NextResponse.redirect(url), csp);
    }
  }

  return applySecurityHeaders(response, csp);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
