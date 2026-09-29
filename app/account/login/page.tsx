import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      redirect("/account/login?error=Please enter your email and password.");
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(
        `/account/login?error=${encodeURIComponent(error.message)}`,
      );
    }

    if (!data.session || !data.user) {
      redirect(
        "/account/login?error=Supabase authenticated the request but returned no session.",
      );
    }

    revalidatePath("/", "layout");

    redirect("/account");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
          Identity Access
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Sign in
        </h1>
        <p className="text-xs text-slate-500 font-mono">
          AUTHENTICATION_REQUIRED to access research workspace.
        </p>
      </header>

      {params.error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-3 text-xs font-mono text-red-300">
          ERROR: {params.error}
        </div>
      )}

      <form
        action={signIn}
        className="p-6 rounded border border-slate-800 bg-slate-900/50 space-y-5"
      >
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-600 transition-colors font-mono"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-[10px] font-bold uppercase tracking-wider text-slate-400"
          >
            Access Key
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-600 transition-colors font-mono"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-tighter text-white hover:bg-blue-500 transition-colors"
        >
          Authenticate
        </button>

        <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-500 font-mono">
          No account?{" "}
          <Link
            href="/account/signup"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            REQUEST_ACCESS
          </Link>
        </div>
      </form>
    </div>
  );
}
