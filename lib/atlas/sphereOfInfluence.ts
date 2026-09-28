/**
 * Sphere of influence / alignment reference for the global atlas.
 *
 * This is a curated, publicly documented approximation (membership or
 * declared partnership), not platform data — it is labelled as such in the
 * atlas UI. ISO3 → bloc label.
 */
export const SPHERE_OF_INFLUENCE: Record<string, string> = {
  // NATO / Europe
  USA: "NATO · Five Eyes", GBR: "NATO · Five Eyes · AUKUS", CAN: "NATO · Five Eyes",
  FRA: "NATO · EU", DEU: "NATO · EU", ITA: "NATO · EU", ESP: "NATO · EU",
  POL: "NATO · EU", NLD: "NATO · EU", BEL: "NATO · EU", LUX: "NATO · EU",
  DNK: "NATO · EU", NOR: "NATO", ISL: "NATO", PRT: "NATO · EU",
  GRC: "NATO · EU", TUR: "NATO", CZE: "NATO · EU", SVK: "NATO · EU",
  HUN: "NATO · EU", ROU: "NATO · EU", BGR: "NATO · EU", HRV: "NATO · EU",
  SVN: "NATO · EU", ALB: "NATO", MNE: "NATO", MKD: "NATO", EST: "NATO · EU",
  LVA: "NATO · EU", LTU: "NATO · EU", FIN: "NATO · EU", SWE: "NATO · EU",
  IRL: "EU (non-NATO)", AUT: "EU (non-NATO)", CHE: "Neutral", MLT: "EU (non-NATO)",
  // Indo-Pacific partners
  AUS: "AUKUS · Five Eyes", NZL: "Five Eyes", JPN: "US treaty ally",
  KOR: "US treaty ally", PHL: "US treaty ally", THA: "US treaty ally",
  TWN: "US security partner", SGP: "US security partner",
  IND: "Quad partner", IDN: "Non-aligned", VNM: "Non-aligned", MYS: "Non-aligned",
  // Russia & partners
  RUS: "CSTO · EAEU", BLR: "CSTO · Russian ally", KAZ: "CSTO",
  KGZ: "CSTO", TJK: "CSTO", ARM: "CSTO", IRN: "Aligned with Russia",
  PRK: "Aligned with Russia", SYR: "Aligned with Russia",
  // China & partners
  CHN: "PRC sphere", PAK: "PRC partner", KHM: "PRC partner", LAO: "PRC partner",
  // Middle East & Africa
  ISR: "US security partner", EGY: "Non-aligned · US partner",
  SAU: "US security partner", ARE: "US security partner", QAT: "US security partner",
  KWT: "US security partner", BHR: "US security partner", OMN: "US security partner",
  JOR: "US security partner", IRQ: "Non-aligned", LBN: "Non-aligned",
  YEM: "Non-aligned", LBY: "Non-aligned", TUN: "Non-aligned",
  DZA: "Non-aligned", MAR: "Non-aligned", ESH: "Disputed",
  NGA: "Non-aligned", GHA: "Non-aligned", SEN: "Non-aligned", CIV: "Non-aligned",
  ETH: "Non-aligned", KEN: "Non-aligned · US partner", SOM: "Non-aligned",
  DJI: "Foreign basing hub", TZA: "Non-aligned", UGA: "Non-aligned",
  ZAF: "BRICS partner", AGO: "Non-aligned", MOZ: "Non-aligned", ZMB: "Non-aligned",
  ZWE: "Non-aligned", NAM: "Non-aligned", BWA: "Non-aligned", MLI: "Russia-aligned",
  BFA: "Russia-aligned", NER: "Russia-aligned", CAF: "Russia-aligned",
  COD: "Non-aligned", COG: "Non-aligned", GAB: "Non-aligned",
  CMR: "Non-aligned", TCD: "Non-aligned", SDN: "Non-aligned", SSD: "Non-aligned",
  ERI: "Non-aligned", RWA: "Non-aligned", BDI: "Non-aligned",
  // Latin America
  MEX: "Non-aligned", GTM: "Non-aligned", HND: "Non-aligned", SLV: "Non-aligned",
  NIC: "Non-aligned", CRI: "Non-aligned", PAN: "Non-aligned", CUB: "Non-aligned",
  DOM: "Non-aligned", HTI: "Non-aligned", JAM: "Non-aligned",
  COL: "US security partner", VEN: "Non-aligned", GUY: "Non-aligned",
  SUR: "Non-aligned", ECU: "Non-aligned", PER: "Non-aligned",
  BOL: "Non-aligned", PRY: "Non-aligned", CHL: "Non-aligned",
  ARG: "Non-aligned", URY: "Non-aligned", BRA: "Non-aligned",
  FLK: "Disputed (UK)", GRL: "Denmark (NATO)",
};

/** Look up a sphere label, falling back to "Unaligned / untracked". */
export function sphereFor(iso3: string | null | undefined): string {
  if (!iso3) return "Untracked";
  return SPHERE_OF_INFLUENCE[iso3.toUpperCase()] ?? "Non-aligned / untracked";
}
