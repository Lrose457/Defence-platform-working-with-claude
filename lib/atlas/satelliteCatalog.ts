/**
 * Curated catalogue of publicly documented military space programmes,
 * used to attribute satellites from CelesTrak group TLEs to operator
 * countries and military roles.
 *
 * Attribution is a documented approximation: a group contains satellites
 * from the listed operator programme(s), not a per-object registry.
 * Object names are matched case-insensitively against the name patterns.
 */

export interface SatelliteAttribution {
  /** Operator country label (e.g. "United States"). */
  country: string;
  /** ISO3 code of the operator country (for map join). */
  iso3: string;
  /** Military role of the programme. */
  role: string;
  /** Programme/constellation names, matched against object names. */
  patterns: RegExp[];
}

/** CelesTrak group slug → curator comment shown in the UI. */
export const GROUP_LABELS: Record<string, string> = {
  military: "US military & early-warning",
  "military-geo": "US military geodetic",
  "military-radar": "US military radar calibration",
  "military-weather": "US military weather (DMSP)",
  recon: "Reconnaissance (multi-national)",
  geo: "Geostationary belt (comms/early-warning)",
  weather: "Civil & military weather",
  stations: "Crewed stations",
  starlink: "Starlink (commercial — context only)",
};

export const SATELLITE_GROUPS = [
  "military",
  "military-geo",
  "military-radar",
  "military-weather",
  "recon",
  "geo",
  "weather",
  "stations",
] as const;

/**
 * Military space programmes by object-name pattern. Order matters:
 * the first matching entry wins, so the most specific patterns come first.
 */
export const SATELLITE_ATTRIBUTION: SatelliteAttribution[] = [
  // ── United States ───────────────────────────────────────────
  { country: "United States", iso3: "USA", role: "Early warning (SBIRS/DSP)", patterns: [/^SBIRS/i, /^DSP\b/i, /^USA\s?2(0[0-9]|1[0-9]|2[0-9])/i] },
  { country: "United States", iso3: "USA", role: "Reconnaissance", patterns: [/^USA-?(22[4-9]|2[3-9][0-9])/i, /^LACROSSE/i, /^ONYX/i, /^KH-?11/i, /^FIA/i, /^TOPAZ/i, /^QUASAR/i, /^MISTY/i, /^ZIRCONIC/i] },
  { country: "United States", iso3: "USA", role: "Navigation (GPS)", patterns: [/^NAVSTAR/i, /^GPS/i, /^USA-?(15[0-9]|1[6-9][0-9])/i] },
  { country: "United States", iso3: "USA", role: "Communications (AEHF/WGS/Skynet lease)", patterns: [/^AEHF/i, /^WGS\b/i, /^MUOS/i, /^FLTSAT/i, /^UFO\b/i, /^MILSTAR/i, /^TDRS/i] },
  { country: "United States", iso3: "USA", role: "Weather (DMSP)", patterns: [/^DMSP/i] },
  { country: "United States", iso3: "USA", role: "Missile tracking / STSS", patterns: [/^STSS/i, /^PTSS/i, /^HBTSS/i, /^PWSA/i, /^TRACER/i] },
  { country: "United States", iso3: "USA", role: "Space domain awareness (GSSAP)", patterns: [/^GSSAP/i, /^Hornet/i] },
  { country: "United States", iso3: "USA", role: "NRO/NRL science & tech demo", patterns: [/^NROL/i, /^USA-[0-9]/i, /^STP-|^STPSat/i, /^X-37/i] },
  // ── Russia ──────────────────────────────────────────────────
  { country: "Russia", iso3: "RUS", role: "Early warning (Oko/Tundra)", patterns: [/^TUNDRA/i, /^US-KMO/i, /^KOSMOS\s?(24|25)[0-9]{2}/i] },
  { country: "Russia", iso3: "RUS", role: "Navigation (GLONASS)", patterns: [/^COSMOS\s?2[45][0-9]{2}\s?\(GLONASS\)/i, /^GLONASS/i, /^KOSMOS.*(GLONASS)/i] },
  { country: "Russia", iso3: "RUS", role: "Reconnaissance / inspection", patterns: [/^KOSMOS/i, /^BARS/i, /^PERSONA/i, /^LOTUS/i, /^GLONASS-K/i] },
  // ── China ───────────────────────────────────────────────────
  { country: "China", iso3: "CHN", role: "Early warning & ISR", patterns: [/^YAOGAN/i, /^GAOFEN/i, /^JILIN/i, /^SHIJIAN/i] },
  { country: "China", iso3: "CHN", role: "Navigation (BeiDou)", patterns: [/^BEIDOU/i, /^BEIDOU-3/i] },
  { country: "China", iso3: "CHN", role: "Reconnaissance (Yaogan/FSW)", patterns: [/^FSW/i, /^CHINA\s?DS/i, /^TIANHE/i] },
  // ── Europe ──────────────────────────────────────────────────
  { country: "United Kingdom", iso3: "GBR", role: "Reconnaissance & comms (Skynet)", patterns: [/^SKYNET/i, /^UK-DMC/i, /^T:/i] },
  { country: "France", iso3: "FRA", role: "Reconnaissance (CSO/Helios)", patterns: [/^CSO-?[0-9]/i, /^HELIOS/i, /^CERES/i, /^ESSAIM/i, /^SYRACUSE/i, /^SENTINEL-?[25]/i] },
  { country: "Germany", iso3: "DEU", role: "Reconnaissance (SAR-Lupe)", patterns: [/^SAR-LUPE/i, /^SARah/i, /^LUH/i] },
  { country: "Italy", iso3: "ITA", role: "Reconnaissance & comms (Sicral)", patterns: [/^SICRAL/i, /^COSMO-SkyMed/i, /^AGILE/i] },
  { country: "Spain", iso3: "ESP", role: "Reconnaissance (Paz/SEOSAT)", patterns: [/^PAZ\b/i, /^SEOSAT/i, /^SPAINSAT/i, /^XTAR/i] },
  { country: "Norway", iso3: "NOR", role: "Maritime surveillance (AISSat)", patterns: [/^AISSAT/i, /^NORsat/i] },
  // ── Indo-Pacific & others ───────────────────────────────────
  { country: "Israel", iso3: "ISR", role: "Reconnaissance (Ofek)", patterns: [/^OFEK/i, /^EROS\b/i] },
  { country: "India", iso3: "IND", role: "Reconnaissance (RISAT/Cartosat)", patterns: [/^RISAT/i, /^CARTOSAT/i, /^EMISAT/i, /^GSAT-?7/i] },
  { country: "Japan", iso3: "JPN", role: "Reconnaissance (IGS)", patterns: [/^IGS\s?[0-9]/i, /^OPTICAL\s?[4567]/i, /^RADAR\s?[2-8]/i, /^Kiku-?8/i] },
  { country: "South Korea", iso3: "KOR", role: "Reconnaissance & comms", patterns: [/^KOREASAT-?[567]/i, /^KOMPSAT/i, /^ARIRANG/i] },
  { country: "Australia", iso3: "AUS", role: "Communications (Optus C1 payload)", patterns: [/^OPTUS/i] },
  { country: "Turkey", iso3: "TUR", role: "Reconnaissance (Göktürk)", patterns: [/^GOKTURK/i, /^GÖKTÜRK/i, /^TURKSAT/i] },
  { country: "International", iso3: "", role: "Crewed station / civil", patterns: [/^ISS \(ZARYA\)/i, /^CSS \(TIANHE\)/i, /^TIANHE/i, /^WENTIAN/i, /^MENGTIAN/i] },
];

/** Attribution for a CelesTrak object name, or null for unattributed. */
export function attribute(name: string): SatelliteAttribution | null {
  for (const entry of SATELLITE_ATTRIBUTION) {
    if (entry.patterns.some((p) => p.test(name))) return entry;
  }
  return null;
}
