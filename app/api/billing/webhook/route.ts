/**
 * Stripe webhook handler for subscription events.
 *
 * Verifies the signed webhook payload using the Stripe signing secret
 * (HMAC-SHA256), then updates the `subscriptions` and `platform_roles`
 * tables to reflect the new state.  All events are processed
 * idempotently: a duplicate event (same Stripe subscription ID) is
 * silently reconciled rather than creating duplicates.
 *
 * Supported event types:
 *   - checkout.session.completed   → create / reactivate subscription
 *   - customer.subscription.created
 *   - customer.subscription.updated → extend / change plan
 *   - customer.subscription.deleted → cancel subscription
 *   - invoice.payment_succeeded    → record successful payment
 *   - invoice.payment_failed       → record failed payment
 *
 * This route does NOT require CSRF protection — it is invoked by
 * Stripe's servers, not by the browser.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Map Stripe price IDs to internal plan names.
function getPlanFromPrice(priceId: string): string {
  const analystId = process.env.STRIPE_ANALYST_PRICE_ID;
  const orgId = process.env.STRIPE_ORGANISATION_PRICE_ID;

  if (analystId && priceId === analystId) return "Analyst";
  if (orgId && priceId === orgId) return "Organisation";
  return "Free";
}

/** Stripe Checkout.Session shape (subset we use) */
type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  customer?: string | null;
  subscription?: string | null;
  customer_details?: {
    email?: string | null;
  };
};

/** Stripe Subscription shape (subset we use) */
type StripeSubscription = {
  id: string;
  object: "subscription";
  status: string;
  current_period_end: number;
  items: {
    data: Array<{ price: { id: string } }>
  };
};

/** Stripe Invoice shape (subset we use) */
type StripeInvoice = {
  id: string;
  object: "invoice";
  subscription?: string | null;
  lines?: {
    data: Array<{ period?: { end?: number } }>
  };
};

/** Discriminated union of the event types we handle. */
type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

/**
 * Verify a Stripe webhook signature.
 *
 * Stripe sends the signature in the `stripe-signature` header with
 * the format:  `t=<timestamp>,v1=<hex-hmac>`
 *
 * We reconstruct the signed payload as `${timestamp}.${rawBody}` and
 * compare its HMAC-SHA256 against the provided `v1` value using a
 * constant-time comparison.  We also reject signatures older than
 * 5 minutes to prevent replay attacks.
 */
function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): { valid: boolean } {
  const parts = signature.split(",");

  let timestamp = "";
  let signatureHash = "";

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") signatureHash = value;
  }

  if (!timestamp || !signatureHash) {
    return { valid: false };
  }

  // Reject events older than 5 minutes (replay protection).
  const eventTime = Number(timestamp);
  if (Number.isNaN(eventTime)) {
    return { valid: false };
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (eventTime < fiveMinutesAgo) {
    return { valid: false };
  }

  const signedPayload = `${timestamp}.${body}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signatureHash, "hex");

  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false };
  }

  const isValid = timingSafeEqual(expectedBuf, providedBuf);

  return { valid: isValid };
}

/**
 * Look up the Supabase user ID associated with a Stripe customer ID.
 */
async function findUserIdByCustomerId(
  supabase: SupabaseClient,
  customerId: string,
) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error || !data) return null;
  return data.user_id;
}

/**
 * Upsert a subscription record from Stripe subscription data.
 */
async function upsertSubscription(
  supabase: SupabaseClient,
  userId: string,
  subscription: StripeSubscription,
  customerId?: string,
) {
  const priceId =
    subscription.items?.data?.[0]?.price?.id ?? "";

  const planName = getPlanFromPrice(priceId);

  const currentPeriodEnd =
    subscription.current_period_end &&
    subscription.current_period_end > 0
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_name: planName,
        plan: planName,
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        current_period_end: currentPeriodEnd,
      },
      { onConflict: "stripe_subscription_id" },
    );

  return error;
}

/**
 * Update the platform_roles table when a user's plan changes.
 * Analyst plan → role "analyst", Organisation plan → role "admin".
 * Free / cancelled → remove the role.
 */
async function syncPlatformRole(
  supabase: SupabaseClient,
  userId: string,
  planName: string,
) {
  if (planName === "Free") {
    await supabase
      .from("platform_roles")
      .delete()
      .eq("user_id", userId);
    return;
  }

  const role = planName === "Analyst" ? "analyst" : "admin";

  await supabase
    .from("platform_roles")
    .upsert({
      user_id: userId,
      role,
      organisation_id: null,
    });
}

/*
 * Error responses are deliberately generic. This endpoint is reachable by
 * any unauthenticated caller, so the body must not disclose configuration
 * state (e.g. whether STRIPE_WEBHOOK_SECRET is set) or which stage of
 * verification rejected the request. Details go to the server log only.
 */
export async function POST(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error(
      "STRIPE_WEBHOOK_SECRET is not set — webhook handler is disabled.",
    );
    return new NextResponse("Webhook handler error", { status: 500 });
  }

  // Read the raw body as text — we need the exact bytes for signature
  // verification.  In the App Router, request.text() returns the
  // unparsed body.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Stripe webhook received a request without a signature header.");
    return new NextResponse("Webhook request rejected", { status: 400 });
  }

  const { valid } = verifyStripeSignature(
    body,
    signature,
    STRIPE_WEBHOOK_SECRET,
  );

  if (!valid) {
    console.error("Webhook signature verification failed.");
    return new NextResponse("Webhook request rejected", { status: 400 });
  }

  let event: StripeEvent;

  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    /*
     * Malformed payloads must 400, not 500: a 5xx tells Stripe to retry,
     * which would replay an event we can never parse.
     */
    console.error("Stripe webhook received a malformed JSON payload.");
    return new NextResponse("Webhook request rejected", { status: 400 });
  }

  /*
   * Service-role client: subscription and platform_roles writes must land
   * regardless of RLS, and the requesting party is Stripe, not a browser.
   */
  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as StripeCheckoutSession;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const customerEmail = session.customer_details?.email;

      let userId: string | null = null;

      if (customerId) {
        userId = await findUserIdByCustomerId(supabase, customerId);
      }

      if (!userId && customerEmail) {
        /*
         * Fallback: resolve the user from the checkout email via the
         * signup profile record (customer_id is not yet stored at this
         * point for brand-new customers).
         */
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", customerEmail)
          .maybeSingle();

        if (profile) {
          userId = profile.id;
        }
      }

      if (!userId || !subscriptionId) {
        console.warn(
          `Webhook checkout.session.completed: no user found for email=${customerEmail}, customer=${customerId}`,
        );
        break;
      }

      /*
       * We don't have the Stripe SDK to fetch the subscription, so
       * we record what we have from the checkout session and
       * update the status.  The customer.subscription.created event
       * will follow shortly with full details.
       */
      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status: "active",
            plan_name: "Free",
            plan: "Free",
          },
          { onConflict: "stripe_subscription_id" },
        );

      if (error) {
        console.error("Failed to upsert subscription:", error);
      }

      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as StripeSubscription;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id, stripe_customer_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (!sub) {
        console.warn(
          `Stripe subscription ${subscription.id} has no matching record in our DB.`,
        );
        break;
      }

      const upsertError = await upsertSubscription(
        supabase,
        sub.user_id,
        subscription,
        sub.stripe_customer_id,
      );

      if (upsertError) {
        console.error("Failed to update subscription:", upsertError);
      }

      const planName = getPlanFromPrice(
        subscription.items?.data?.[0]?.price?.id ?? "",
      );
      await syncPlatformRole(supabase, sub.user_id, planName);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as StripeSubscription;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        await syncPlatformRole(supabase, sub.user_id, "Free");
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as StripeInvoice;

      if (invoice.subscription) {
        const periodEnd =
          invoice.lines?.data?.[0]?.period?.end;

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            ...(periodEnd
              ? {
                  current_period_end: new Date(
                    periodEnd * 1000,
                  ).toISOString(),
                }
              : {}),
          })
          .eq("stripe_subscription_id", invoice.subscription);

        if (error) {
          console.error(
            "Failed to update subscription on payment:",
            error,
          );
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as StripeInvoice;

      if (invoice.subscription) {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", invoice.subscription);
      }
      break;
    }

    default:
      // Unhandled event type — ignore silently.
      break;
  }

  return NextResponse.json({ received: true });
}
