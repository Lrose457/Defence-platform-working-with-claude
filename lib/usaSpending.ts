import { validateOutboundUrl } from "@/lib/security/ssrf";

const USA_SPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
const EARLIEST_DATE = "2007-10-01";

export const companyRecipientSearch: Record<string, string[]> = {
  "comp-1": ["Lockheed Martin"],
  "comp-2": ["Northrop Grumman"],
  "comp-3": ["Raytheon", "RTX"],
  "comp-4": ["General Dynamics"],
  "comp-5": ["BAE Systems"],
  "comp-6": ["Rolls-Royce", "Rolls Royce"],
  "comp-7": ["Thales"],
  "comp-8": ["Airbus Defence", "Airbus Defense"],
  "comp-9": ["Rheinmetall"],
  "comp-10": ["Leonardo"],
  "comp-11": ["Mitsubishi Heavy Industries"],
  "comp-12": ["Hanwha Aerospace"],
  "comp-13": ["AVIC", "Aviation Industry Corporation of China"],
};

export type UsaSpendingContract = {
  awardId: string;
  internalId: number | null;
  recipientName: string;
  amount: number | null;
  description: string | null;
  awardingAgency: string | null;
  startDate: string | null;
  endDate: string | null;
  awardType: string | null;
  sourceUrl: string;
  itemName: string | null;
  whyIncluded: string;
  itemType: string | null;
  importance: string;
  quantity: number | null;
  unitCostUsd: number | null;
  destination: string | null;
};

type UsaSpendingResponse = {
  results?: Array<{
    internal_id?: number;
    "Award ID"?: string;
    "Recipient Name"?: string;
    "Award Amount"?: number;
    "Award Description"?: string | null;
    "Awarding Agency"?: string | null;
    "Period of Performance Start Date"?: string | null;
    "Period of Performance Current End Date"?: string | null;
    "Award Type"?: string | null;
    generated_internal_id?: string;
  }>;
};

const defenceAgencyTerms = [
  "defense",
  "defence",
  "department of defense",
  "department of the army",
  "department of the navy",
  "department of the air force",
  "air force",
  "army",
  "navy",
  "marine corps",
  "space force",
  "darpa",
  "missile defense",
  "defense logistics",
  "special operations",
  "national security",
];

const defenceDescriptionTerms = [
  "military",
  "missile",
  "munitions",
  "weapon",
  "aircraft",
  "fighter",
  "bomber",
  "frigate",
  "submarine",
  "tank",
  "armored",
  "radar",
  "propulsion",
  "surveillance",
  "ammunition",
  "combat",
  "tactical",
  "defense",
  "defence",
];

const civilianRecipientExclusions = [
  "hotel",
  "hotels",
  "resort",
  "resorts",
  "hospitality",
  "realty",
  "property",
  "insurance",
  "healthcare",
  "food",
  "beverage",
];

function includesTerm(value: string | null | undefined, terms: string[]) {
  const normalized = (value ?? "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function classifyItem(description: string | null) {
  const value = (description ?? "").toLowerCase();
  const categories: [string, string][] = [
    ["Aircraft", "aircraft"],
    ["Missile or weapon system", "missile"],
    ["Ammunition or munitions", "munition"],
    ["Naval platform", "frigate"],
    ["Naval platform", "submarine"],
    ["Armoured vehicle", "tank"],
    ["Radar or surveillance system", "radar"],
    ["Propulsion system", "propulsion"],
    ["Military information technology", "cyber"],
  ];

  return categories.find(([, term]) => value.includes(term))?.[0] ?? null;
}

function classifyImportance(agency: string | null, description: string | null) {
  if (includesTerm(description, ["missile", "nuclear", "aircraft", "submarine", "radar"])) {
    return "Defence capability or strategic system";
  }

  if (includesTerm(agency, ["defense logistics", "defence logistics"])) {
    return "Critical defence supply and logistics";
  }

  return "Defence-related federal award";
}

export function isDefenceContract(
  recipient: string | null | undefined,
  awardingAgency: string | null | undefined,
  description: string | null | undefined,
) {
  if (includesTerm(recipient, civilianRecipientExclusions)) return false;

  return (
    includesTerm(awardingAgency, defenceAgencyTerms) ||
    includesTerm(description, defenceDescriptionTerms)
  );
}

export async function fetchUsaSpendingContracts(
  companyId: string,
  limit = 25,
): Promise<UsaSpendingContract[]> {
  const recipientSearchText = companyRecipientSearch[companyId];
  if (!recipientSearchText) return [];

  /*
   * SSRF protection: validate the outbound URL is not pointing to a
   * private or restricted network before making the request.
   */
  try {
    await validateOutboundUrl(USA_SPENDING_URL);
  } catch {
    return [];
  }

  const response = await fetch(USA_SPENDING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: {
        time_period: [{ start_date: EARLIEST_DATE, end_date: new Date().toISOString().slice(0, 10) }],
        award_type_codes: ["A", "B", "C", "D"],
        recipient_search_text: recipientSearchText,
      },
      fields: [
        "Award ID",
        "Recipient Name",
        "Award Amount",
        "Award Description",
        "Awarding Agency",
        "Period of Performance Start Date",
        "Period of Performance Current End Date",
        "Award Type",
        "generated_internal_id",
      ],
      limit,
      page: 1,
      subawards: false,
      order: "desc",
    }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`USAspending request failed with ${response.status}`);
  }

  const payload = (await response.json()) as UsaSpendingResponse;
  const results: UsaSpendingContract[] = [];

  for (const record of payload.results ?? []) {
    if (
      !isDefenceContract(
        record["Recipient Name"],
        record["Awarding Agency"],
        record["Award Description"],
      )
    ) {
      continue;
    }

    results.push({
      awardId: record["Award ID"] ?? record.generated_internal_id ?? "Unknown",
      internalId: record.internal_id ?? null,
      recipientName: record["Recipient Name"] ?? "Unknown recipient",
      amount: record["Award Amount"] ?? null,
      description: record["Award Description"] ?? null,
      awardingAgency: record["Awarding Agency"] ?? null,
      startDate: record["Period of Performance Start Date"] ?? null,
      endDate: record["Period of Performance Current End Date"] ?? null,
      awardType: record["Award Type"] ?? null,
      sourceUrl: "https://www.usaspending.gov/",
      itemName: record["Award Description"] ?? null,
      whyIncluded: "Matched a defence agency or defence programme term in the public award record.",
      itemType: classifyItem(record["Award Description"] ?? null),
      importance: classifyImportance(record["Awarding Agency"] ?? null, record["Award Description"] ?? null),
      quantity: null,
      unitCostUsd: null,
      destination: null,
    });
  }

  /*
   * Paginate: if the response indicates more pages are available
   * (results.length === limit), fetch the next page.
   */
  const hasMore = (payload.results?.length ?? 0) === limit && limit < 100;
  if (hasMore) {
    const nextPage = await fetch(USA_SPENDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          time_period: [{ start_date: EARLIEST_DATE, end_date: new Date().toISOString().slice(0, 10) }],
          award_type_codes: ["A", "B", "C", "D"],
          recipient_search_text: recipientSearchText,
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Award Description",
          "Awarding Agency",
          "Period of Performance Start Date",
          "Period of Performance Current End Date",
          "Award Type",
          "generated_internal_id",
        ],
        limit: Math.min(limit, 100),
        page: 2,
        subawards: false,
        order: "desc",
      }),
      next: { revalidate: 3600 },
    });

    if (nextPage.ok) {
      const nextPayload = (await nextPage.json()) as UsaSpendingResponse;
      for (const record of nextPayload.results ?? []) {
        const contract = {
          awardId: record["Award ID"] ?? record.generated_internal_id ?? "Unknown",
          internalId: record.internal_id ?? null,
          recipientName: record["Recipient Name"] ?? "Unknown recipient",
          amount: record["Award Amount"] ?? null,
          description: record["Award Description"] ?? null,
          awardingAgency: record["Awarding Agency"] ?? null,
          startDate: record["Period of Performance Start Date"] ?? null,
          endDate: record["Period of Performance Current End Date"] ?? null,
          awardType: record["Award Type"] ?? null,
          sourceUrl: "https://www.usaspending.gov/",
          itemName: record["Award Description"] ?? null,
          whyIncluded: "Matched a defence agency or defence programme term in the public award record.",
          itemType: classifyItem(record["Award Description"] ?? null),
          importance: classifyImportance(record["Awarding Agency"] ?? null, record["Award Description"] ?? null),
          quantity: null,
          unitCostUsd: null,
          destination: null,
        };
        if (
          isDefenceContract(
            contract.recipientName,
            contract.awardingAgency,
            contract.description,
          )
        ) {
          results.push(contract);
        }
      }
    }
  }

  return results;
}