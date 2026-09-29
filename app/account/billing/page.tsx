import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Subscription = {
  id: number;
  organisation_id: number;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

const plans = [
  {
    name: "Free",
    price: "£0",
    description: "Explore the public intelligence platform.",
    features: [
      "Public defence data",
      "Country profiles",
      "Equipment profiles",
      "Basic comparisons",
    ],
  },
  {
    name: "Analyst",
    price: "Coming soon",
    description: "Personal research tools for professional users.",
    features: [
      "Saved investigations",
      "Watchlists",
      "Alerts",
      "Exports",
    ],
  },
  {
    name: "Organisation",
    price: "Coming soon",
    description: "Shared intelligence workspace for teams.",
    features: [
      "Organisation workspace",
      "Team members",
      "Shared research",
      "Higher usage limits",
    ],
  },
];

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscriptions: Subscription[] = [];
  let error: string | null = null;

  if (user) {
    const membershipResult = await supabase
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", user.id);

    if (membershipResult.error) {
      error = membershipResult.error.message;
    } else {
      const organisationIds = (membershipResult.data || []).map(
        (row) => row.organisation_id,
      );

      if (organisationIds.length > 0) {
        const result = await supabase
          .from("subscriptions")
          .select(
            "id,organisation_id,plan,status,current_period_start,current_period_end",
          )
          .in("organisation_id", organisationIds)
          .order("created_at", { ascending: false });

        if (result.error) {
          error = result.error.message;
        } else {
          subscriptions = (result.data || []) as Subscription[];
        }
      }
    }
  }

  return (
    <div className="w-full max-w-300 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
          Account
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          Plans & access
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Commercial access will build on the public intelligence
          platform and personal research workspace.
        </p>
      </header>

      {!user ? (
        <section className="intel-surface p-6">
          <h2 className="text-xl font-semibold">
            Sign in to view your workspace
          </h2>

          <Link
            href="/account/login"
            className="mt-6 inline-flex rounded-lg bg-sky-400 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </section>
      ) : (
        <>
          {error && (
            <section className="intel-surface border-red-900 p-5 text-sm text-red-300">
              {error}
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className="intel-surface flex flex-col p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Plan
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {plan.name}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {plan.description}
                </p>

                <p className="mt-6 text-2xl font-bold">
                  {plan.price}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-3 text-sm text-slate-400"
                    >
                      <span className="text-green-400">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled
                  className="mt-7 min-h-11 rounded-lg border border-slate-800 px-4 py-2.5 text-sm text-slate-600"
                >
                  Available soon
                </button>
                {plan.name !== "Free" && (
                  <Link
                    href={`/api/billing/checkout?plan=${plan.name.toLowerCase()}`}
                    className="mt-3 text-center text-xs text-sky-400 hover:text-sky-300"
                  >
                    Continue to secure hosted checkout
                  </Link>
                )}
              </article>
            ))}
          </section>

          <section className="intel-surface p-6">
            <h2 className="text-xl font-semibold">
              Current subscriptions
            </h2>

            {subscriptions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No organisation subscription is currently active.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {subscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <p className="font-semibold capitalize">
                          {subscription.plan || "Free"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Organisation #{subscription.organisation_id}
                        </p>
                      </div>

                      <span className="text-sm text-green-400">
                        {subscription.status || "active"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="intel-surface p-6">
            <h2 className="text-xl font-semibold">
              Commercial roadmap
            </h2>

            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-400">
              <p>
                Subscription tiers will control access to advanced
                research features and usage limits.
              </p>

              <p>
                Organisation plans will support shared workspaces and
                team access.
              </p>

              <p>
                Payment-provider integration will be added after the
                product limits and commercial rules are finalised.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}