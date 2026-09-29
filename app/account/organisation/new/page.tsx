import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function NewOrganisationPage() {
  async function createOrganisation(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();

    if (!name) {
      redirect("/account/organisation/new?error=Name%20is%20required");
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/account/login");
    }

    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || null;

    if (!slug) {
      redirect("/account/organisation/new?error=Invalid%20organisation%20name");
    }

    /*
     * Check for an existing slug to give a friendly error before the
     * atomic insert.
     */
    const { data: existing } = await supabase
      .from("organisations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      redirect(
        `/account/organisation/new?error=${encodeURIComponent("An organisation with that name already exists. Please choose another.")}`,
      );
    }

    const { data: orgId, error } = await supabase.rpc(
      "create_organisation_with_owner",
      {
        _user_id: user.id,
        _name: name,
        _slug: slug,
        _plan: "free",
      },
    );

    if (error || !orgId) {
      redirect(
        `/account/organisation/new?error=${encodeURIComponent(error?.message || "Unable to create organisation")}`,
      );
    }

    redirect(`/account/organisation/${orgId}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Workspace
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Create organisation
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Create a workspace for shared research and future commercial
          access.
        </p>
      </header>

      <form
        action={createOrganisation}
        className="intel-surface space-y-6 p-6"
      >
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium"
          >
            Organisation name
          </label>

          <input
            id="name"
            name="name"
            required
            maxLength={120}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-sky-500"
            placeholder="Example Research Group"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300"
        >
          Create organisation
        </button>
      </form>
    </div>
  );
}