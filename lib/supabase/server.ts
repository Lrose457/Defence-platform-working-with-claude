import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  {
                    ...options,
                    httpOnly: true,
                    sameSite: "strict",
                    secure: true,
                    path: "/",
                  },
                );
              },
            );
          } catch {
            /*
             * Server Components can sometimes be unable
             * to write cookies. Middleware/proxy handles
             * session refreshes in that situation.
             */
          }
        },
      },
    },
  );
}

/**
 * Authentication / authorization helpers for server-side route handlers.
 *
 * These return NextResponse objects so they can short-circuit a request
 * directly, or a `{ supabase, user }` tuple for the happy path.
 */

/** Result type returned by requireUser when authentication fails. */
type AuthResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: User }
  | { ok: false; response: NextResponse };

/**
 * Require an authenticated user.
 *
 * Returns `{ ok: true, supabase, user }` on success, or a 401
 * NextResponse when the user is not logged in.
 *
 * Usage in API routes:
 *   const result = await requireUser();
 *   if (!result.ok) return result.response;
 *   const { supabase, user } = result;
 */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  return { ok: true, supabase, user };
}

/**
 * Require a platform analyst or admin.
 *
 * Checks the `platform_roles` table for the current user.  Returns
 * a 401 if unauthenticated, or a 403 if the user lacks the required
 * role.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["analyst", "admin"])
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Role check failed." },
        { status: 500 },
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Platform analyst permissions are required." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, user };
}

/**
 * Require the current user to be a member of the given organisation.
 *
 * Throws / returns 403 if the user is not a member.
 */
export async function requireOrgMember(
  organisationId: string | number,
): Promise<AuthResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("organisation_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Organisation membership check failed." },
        { status: 500 },
      ),
    };
  }

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You are not a member of this organisation." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, user };
}