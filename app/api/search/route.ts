import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ANONYMOUS_SESSION_COOKIE, newAnonymousSessionId, FCRA_DISCLAIMER } from "@/lib/security/privacy";
import { log_search_query } from "@/lib/security/searchLog";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { rateLimitDb } from "@/lib/security/rateLimitDb";
import { sanitizeText } from "@/lib/security/sanitize";

const ALLOWED_TYPES = new Set([
  "all",
  "country",
  "company",
  "equipment",
  "programme",
  "contract",
  "source",
]);

export async function GET(request: NextRequest) {
  const rateLimitResult = rateLimit(`search:${requestKey(request)}`);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please try again later.", disclaimer: FCRA_DISCLAIMER },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } },
    );
  }

  const supabase = await createClient();

  /*
   * Distributed rate-limit check across serverless instances.
   * Falls back to allowing the request if the DB is unavailable;
   * the in-memory limiter above still provides per-instance protection.
   */
  const dbLimit = await rateLimitDb(
    supabase,
    `search:${requestKey(request)}`,
    30,
  );
  if (!dbLimit.allowed) {
    return NextResponse.json(
      { error: "Too many searches. Please try again later.", disclaimer: FCRA_DISCLAIMER },
      { status: 429, headers: { "Retry-After": String(dbLimit.retryAfter) } },
    );
  }

  const searchParams = request.nextUrl.searchParams;

  const query = sanitizeText(searchParams.get("q"), 200).trim();
  const requestedType = searchParams.get("type") || "all";

  if (!query) {
    return NextResponse.json({ results: [], disclaimer: FCRA_DISCLAIMER });
  }

  const type = ALLOWED_TYPES.has(requestedType)
    ? requestedType
    : "all";

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const offset = (page - 1) * limit;

  /*
   * Apply the type filter inside the query itself so the exact count and
   * pagination reflect the filtered result set (previously the filter ran
   * after fetching, breaking pagination and totals).
   */
  let searchQuery = supabase
    .from("global_entity_search")
    .select(
      "entity_id, entity_type, entity_name, entity_group, identifier, description",
      { count: "exact" },
    )
    .ilike("entity_name", `%${query}%`);

  if (type !== "all") {
    searchQuery = searchQuery.eq("entity_type", type);
  }

  const { data, error, count } = await searchQuery
    .order("entity_name")
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
        results: [],
      },
      { status: 500 },
    );
  }

  const filtered = data || [];

  const response = NextResponse.json({
    results: filtered,
    disclaimer: FCRA_DISCLAIMER,
    pagination: {
      page,
      limit,
      totalResults: count ?? filtered.length,
      totalPages: count
        ? Math.ceil(count / limit)
        : 1,
    },
  });
  const sessionId = request.cookies.get(ANONYMOUS_SESSION_COOKIE)?.value || newAnonymousSessionId();

  try {
    await log_search_query(sessionId, query, filtered.length);
  } catch {
    // Search remains available if the optional audit table is not deployed yet.
  }

  if (!request.cookies.has(ANONYMOUS_SESSION_COOKIE)) {
    response.cookies.set(ANONYMOUS_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return response;
}