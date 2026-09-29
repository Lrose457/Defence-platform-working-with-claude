/**
 * Client-side helper for making CSRF-protected fetch requests.
 *
 * Reads the CSRF token from the <meta name="csrf-token"> tag embedded
 * in the page by the root layout, and includes it in the
 * `X-CSRF-Token` header on POST/PUT/DELETE/PATCH requests.
 */

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;

  const meta = document.querySelector(
    'meta[name="csrf-token"]',
  );
  if (meta) {
    return meta.getAttribute("content") || null;
  }

  return null;
}

/**
 * Wrap fetch with automatic CSRF header injection.
 *
 * Usage:
 *   csrfFetch("/api/intelligence/ingestion/review", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ ... }),
 *   });
 */
export async function csrfFetch(
  input: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const needsCsrf = !["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(init.headers);

  if (needsCsrf) {
    const token = getCsrfToken();
    if (token) {
      headers.set("x-csrf-token", token);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
