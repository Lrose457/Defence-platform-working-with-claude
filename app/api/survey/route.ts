import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { sanitizeText } from "@/lib/security/sanitize";
import { ANONYMOUS_SESSION_COOKIE } from "@/lib/security/privacy";

export async function POST(request: Request) {
  const limit = rateLimit(`survey:${requestKey(request)}`, 5);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { role?: unknown; organisation_type?: unknown; benefit?: unknown; comments?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const role = sanitizeText(body.role, 80).trim();
  const organisationType = sanitizeText(body.organisation_type, 120).trim();
  const benefit = sanitizeText(body.benefit, 120).trim();
  const comments = sanitizeText(body.comments, 1_000).trim();

  if (!role || !benefit) {
    return NextResponse.json(
      { error: "Role and benefit are required." },
      { status: 400 },
    );
  }

  /*
   * Stored against the anonymous session id only — and the id itself is
   * hashed at write time by the search-log path. No IP, no email, no user
   * id is recorded with survey answers.
   */
  const sessionId =
    request.headers
      .get("cookie")
      ?.match(new RegExp(`${ANONYMOUS_SESSION_COOKIE}=([^;]+)`))?.[1] ?? null;

  const supabase = await createClient();
  const { error } = await supabase.from("user_survey_responses").insert({
    role,
    organisation_type: organisationType || null,
    benefit,
    comments: comments || null,
    anonymous_session_hash: sessionId
      ? (await import("@/lib/security/privacy")).hashAnonymousSession(sessionId)
      : null,
  });

  if (error) {
    console.error("Survey insert failed:", error.message);
    return NextResponse.json(
      { error: "Unable to record response." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
