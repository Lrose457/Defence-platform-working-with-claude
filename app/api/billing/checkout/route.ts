import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, requestKey } from "@/lib/security/rateLimit";
import { rateLimitDb } from "@/lib/security/rateLimitDb";

const PRICE_IDS: Record<string, string | undefined> = {
  analyst: process.env.STRIPE_ANALYST_PRICE_ID,
  organisation: process.env.STRIPE_ORGANISATION_PRICE_ID,
};

export async function GET(request: NextRequest) {
  const limit = rateLimit(`checkout:${requestKey(request)}`, 10);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
  }

  const supabase = await createClient();

  /* Distributed rate-limit check across serverless instances. */
  const dbLimit = await rateLimitDb(supabase, `checkout:${requestKey(request)}`, 10);
  if (!dbLimit.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/account/login", request.url));

  const plan = request.nextUrl.searchParams.get("plan") || "";
  const price = PRICE_IDS[plan];
  const secret = process.env.STRIPE_SECRET_KEY;

  if (!price || !secret) {
    return NextResponse.json({ error: "This plan is not available for checkout yet." }, { status: 503 });
  }

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${request.nextUrl.origin}/account/billing?checkout=success`,
    cancel_url: `${request.nextUrl.origin}/account/billing?checkout=cancelled`,
    customer_email: user.email || "",
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    cache: "no-store",
  });

  if (!stripeResponse.ok) {
    return NextResponse.json({ error: "Unable to create secure checkout session." }, { status: 502 });
  }

  const session = await stripeResponse.json() as { url?: string };
  return session.url
    ? NextResponse.redirect(session.url)
    : NextResponse.json({ error: "Checkout provider returned no redirect." }, { status: 502 });
}
