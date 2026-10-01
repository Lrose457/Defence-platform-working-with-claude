import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCountryRegion } from "@/lib/countryRegions";

/**
 * GET /api/countries — lean dataset behind the /countries index.
 *
 * The index used to server-render all 203 country rows plus a 2,300-row
 * budget fold into the SSR HTML (~330 KB). This endpoint ships the same
 * information as a small JSON payload: one row per country with its region
 * resolved server-side (so the ~200-entry region map never reaches the
 * client bundle) and the latest budget joined from the
 * `latest_budget_overview` view, which does the year-fold in Postgres.
 */

export const dynamic = "force-dynamic";

interface BudgetRow {
  country_id: number;
  year: number;
  amount_usd: number | null;
  is_estimate: boolean | null;
}

export async function GET() {
  const supabase = await createClient();

  const [countriesRes, budgetsRes] = await Promise.all([
    supabase
      .from("countries")
      .select("id, name, iso_code, region")
      .order("name"),
    supabase
      .from("latest_budget_overview")
      .select("country_id, year, amount_usd, is_estimate"),
  ]);

  if (countriesRes.error) {
    return NextResponse.json(
      { error: countriesRes.error.message },
      { status: 500 },
    );
  }

  // Budget errors are non-fatal: the table renders "Not recorded" instead.
  const budgetByCountry = new Map<
    number,
    { year: number; amount_usd: number | null; is_estimate: boolean }
  >();
  for (const row of (budgetsRes.data ?? []) as BudgetRow[]) {
    budgetByCountry.set(Number(row.country_id), {
      year: row.year,
      amount_usd: row.amount_usd,
      is_estimate: row.is_estimate ?? false,
    });
  }

  const rows = (countriesRes.data ?? []).map((country) => ({
    id: country.id as number,
    name: (country.name as string | null) ?? "",
    iso_code: (country.iso_code as string | null) ?? "",
    region: getCountryRegion(country as { name?: string | null; region?: string | null }),
    latest_budget: budgetByCountry.get(country.id as number) ?? null,
  }));

  return NextResponse.json({ rows });
}
