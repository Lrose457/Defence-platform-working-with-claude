"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/account");
        return;
      }

      setSuccess(
        "Account created. Check your email to confirm your account before signing in.",
      );
    } catch {
      setError(
        "Something went wrong while creating your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-1">
        <Link
          href="/account"
          className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
        >
          &larr; Account
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white">Create Account</h1>
        <p className="text-xs text-slate-500 font-mono uppercase">Provision personal research workspace</p>
      </header>

      <section className="p-6 rounded border border-slate-800 bg-slate-900/50">
        <form onSubmit={handleSubmit} className="space-y-5">
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
              inputMode="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-600 transition-colors font-mono"
            />
            <p className="mt-1 text-[10px] text-slate-600 font-mono">Minimum 8 characters required.</p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirm-password"
              className="block text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >
              Confirm Access Key
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-600 transition-colors font-mono"
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded border border-red-900 bg-red-950/30 p-3 text-xs font-mono text-red-300"
            >
              ERROR: {error}
            </div>
          ) : null}

          {success ? (
            <div
              role="status"
              className="rounded border border-green-900 bg-green-950/30 p-3 text-xs font-mono text-green-300"
            >
              SUCCESS: {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 rounded bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-tighter text-white hover:bg-blue-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "PROVISIONING..." : "CREATE_ACCOUNT"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-4 text-center text-xs text-slate-500 font-mono">
          Already have an account?{" "}
          <Link
            href="/account/login"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            SIGN_IN
          </Link>
        </div>
      </section>

      <details className="p-4 rounded border border-slate-800 bg-slate-900/50">
        <summary className="text-xs font-bold uppercase tracking-widest text-slate-400 cursor-pointer">
          Account Provisioning Details
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 font-mono">
          Your account is used to keep personal research activity such as
          saved investigations, watchlists and preferences separate from
          the public intelligence database.
        </p>
      </details>
    </div>
  );
}
