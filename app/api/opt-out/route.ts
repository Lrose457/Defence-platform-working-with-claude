import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { sanitizeText } from "@/lib/security/sanitize";

export async function POST(request: Request) {
  const limit = rateLimit(`opt-out:${requestKey(request)}`, 5);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: { name?: unknown; email?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = sanitizeText(body.name, 200).trim();
  const email = sanitizeText(body.email, 320).trim().toLowerCase();
  const details = sanitizeText(body.details, 4_000).trim();

  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !details) {
    return NextResponse.json({ error: "Name, valid email, and request details are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("privacy_requests").insert({
    request_type: "opt_out",
    name,
    email,
    details,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Unable to record request." }, { status: 500 });
  return NextResponse.json({ success: true });
}
