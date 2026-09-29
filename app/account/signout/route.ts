import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getLoginResponse(request: Request) {
  const response = NextResponse.redirect(
    new URL("/account/login", request.url),
  );

  /*
   * Supabase SSR normally removes the auth cookies through
   * supabase.auth.signOut().
   *
   * These headers also prevent a cached authenticated page
   * from being reused after sign-out.
   */
  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0",
  );

  return response;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase sign-out error:", error);
  }

  return getLoginResponse(request);
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Supabase sign-out error:", error);
  }

  return getLoginResponse(request);
}