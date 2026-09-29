/**
 * Defence company stock ticker symbols.
 *
 * Symbols use Yahoo Finance conventions:
 *   • US exchanges (NYSE/NASDAQ): bare ticker  (e.g. "LMT")
 *   • London (LSE):                 .L      (e.g. "BA.L")
 *   • Euronext Paris:              .PA     (e.g. "HO.PA")
 *   • XETRA / Frankfurt:           .DE     (e.g. "RHM.DE")
 *   • Borsa Italiana:              .MI     (e.g. "LDO.MI")
 *   • Stockholm:                   .ST     (e.g. "SAAB-B.ST")
 *   • Tokyo:                       .T      (e.g. "7012.T")
 *   • Korea Exchange:              .KS     (e.g. "272880.KS")
 *   • Toronto:                     .TO     (e.g. "CAE.TO")
 *
 * companyId maps to the `id` field in lib/data.ts so that the
 * ticker can deep-link to an existing company profile page.
 */

export type DefenceSector =
  | "Aerospace"
  | "Naval"
  | "Missiles"
  | "Land"
  | "Electronic Warfare"
  | "Cyber"
  | "Propulsion"
  | "Simulation"
  | "Services"
  | "Heavy Machinery";

export interface DefenceStockSymbol {
  /** Yahoo Finance symbol, used in API calls. */
  symbol: string;
  /** Company display name. */
  name: string;
  /** Exchange display name (e.g. "NYSE", "LSE", "Euronext Paris"). */
  exchange: string;
  /** ISO country code for flag display. */
  country: string;
  /** Defence sub-sector. */
  sector: DefenceSector;
  /** ISO currency code for the exchange. */
  currency: string;
  /** Maps to companies.id in data.ts (if the company has a profile page). */
  companyId?: string;
  /** Approximate market cap for fallback display when API is unavailable. */
  marketCap?: string;
}

/**
 * Normalised quote returned by /api/stocks — identical shape whether
 * the data was freshly fetched from Yahoo Finance or served from cache.
 */
export interface StockQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  volume: number | null;
  marketState: string;
  exchange: string;
  country: string;
  sector: DefenceSector;
  currency: string;
  companyId?: string;
  timestamp: number | null;
}

/**
 * Curated list of publicly-traded defence companies, ordered by
 * market-cap (largest first) to give the ticker a natural priority
 * — the big primes scroll first.
 *
 * AVIC (comp-13 in data.ts) is state-owned and **not** publicly traded,
 * so it is intentionally excluded.
 */
export const defenceStockSymbols: DefenceStockSymbol[] = [
  // ── United States (NYSE / NASDAQ) ──────────────────────────
  {
    symbol: "LMT",
    name: "Lockheed Martin",
    exchange: "NYSE",
    country: "us",
    sector: "Aerospace",
    currency: "USD",
    companyId: "comp-1",
    marketCap: "$110B",
  },
  {
    symbol: "RTX",
    name: "Raytheon Technologies",
    exchange: "NYSE",
    country: "us",
    sector: "Missiles",
    currency: "USD",
    companyId: "comp-3",
    marketCap: "$120B",
  },
  {
    symbol: "NOC",
    name: "Northrop Grumman",
    exchange: "NYSE",
    country: "us",
    sector: "Aerospace",
    currency: "USD",
    companyId: "comp-2",
    marketCap: "$65B",
  },
  {
    symbol: "GD",
    name: "General Dynamics",
    exchange: "NYSE",
    country: "us",
    sector: "Naval",
    currency: "USD",
    companyId: "comp-4",
    marketCap: "$75B",
  },
  {
    symbol: "BA",
    name: "Boeing Defense",
    exchange: "NYSE",
    country: "us",
    sector: "Aerospace",
    currency: "USD",
    marketCap: "$150B",
  },
  {
    symbol: "LHX",
    name: "L3Harris Technologies",
    exchange: "NYSE",
    country: "us",
    sector: "Electronic Warfare",
    currency: "USD",
    marketCap: "$45B",
  },
  {
    symbol: "LDM",
    name: "Leidos",
    exchange: "NYSE",
    country: "us",
    sector: "Cyber",
    currency: "USD",
    marketCap: "$22B",
  },
  {
    symbol: "HII",
    name: "Huntington Ingalls",
    exchange: "NYSE",
    country: "us",
    sector: "Naval",
    currency: "USD",
    marketCap: "$12B",
  },
  {
    symbol: "CAI",
    name: "CACI International",
    exchange: "NYSE",
    country: "us",
    sector: "Services",
    currency: "USD",
    marketCap: "$8B",
  },
  {
    symbol: "TXT",
    name: "Textron",
    exchange: "NYSE",
    country: "us",
    sector: "Aerospace",
    currency: "USD",
    marketCap: "$16B",
  },
    {
    symbol: "ESLT",
    name: "Elbit Systems",
    exchange: "NASDAQ",
    country: "il",
    sector: "Electronic Warfare",
    currency: "USD",
    marketCap: "$20B",
  },

  // ── United Kingdom (LSE) ────────────────────────────────────
  {
    symbol: "BA.L",
    name: "BAE Systems",
    exchange: "LSE",
    country: "gb",
    sector: "Land",
    currency: "GBP",
    companyId: "comp-5",
    marketCap: "£32B",
  },
  {
    symbol: "RR.L",
    name: "Rolls-Royce",
    exchange: "LSE",
    country: "gb",
    sector: "Propulsion",
    currency: "GBP",
    companyId: "comp-6",
    marketCap: "£40B",
  },
  {
    symbol: "QQ.L",
    name: "QinetiQ",
    exchange: "LSE",
    country: "gb",
    sector: "Services",
    currency: "GBP",
    marketCap: "£3B",
  },

  // ── Europe ──────────────────────────────────────────────────
  {
    symbol: "HO.PA",
    name: "Thales",
    exchange: "Euronext Paris",
    country: "fr",
    sector: "Electronic Warfare",
    currency: "EUR",
    companyId: "comp-7",
    marketCap: "€28B",
  },
  {
    symbol: "AIR.PA",
    name: "Airbus",
    exchange: "Euronext Paris",
    country: "de",
    sector: "Aerospace",
    currency: "EUR",
    companyId: "comp-8",
    marketCap: "€100B",
  },
  {
    symbol: "RHM.DE",
    name: "Rheinmetall",
    exchange: "XETRA",
    country: "de",
    sector: "Land",
    currency: "EUR",
    companyId: "comp-9",
    marketCap: "€15B",
  },
  {
    symbol: "LDO.MI",
    name: "Leonardo",
    exchange: "Borsa Italiana",
    country: "it",
    sector: "Aerospace",
    currency: "EUR",
    companyId: "comp-10",
    marketCap: "€12B",
  },
  {
    symbol: "SAAB-B.ST",
    name: "Saab",
    exchange: "Stockholm",
    country: "se",
    sector: "Electronic Warfare",
    currency: "SEK",
    marketCap: "300B SEK",
  },
  {
    symbol: "DSY.PA",
    name: "Dassault Aviation",
    exchange: "Euronext Paris",
    country: "fr",
    sector: "Aerospace",
    currency: "EUR",
    marketCap: "€50B",
  },

  // ── Asia-Pacific ────────────────────────────────────────────
  {
    symbol: "7012.T",
    name: "Mitsubishi Heavy Industries",
    exchange: "Tokyo",
    country: "jp",
    sector: "Heavy Machinery",
    currency: "JPY",
    companyId: "comp-11",
    marketCap: "¥4T",
  },
  {
    symbol: "272880.KS",
    name: "Hanwha Aerospace",
    exchange: "Korea Exchange",
    country: "kr",
    sector: "Aerospace",
    currency: "KRW",
    companyId: "comp-12",
    marketCap: "₩12T",
  },
  {
    symbol: "086500.KS",
    name: "Hyundai Rotem",
    exchange: "Korea Exchange",
    country: "kr",
    sector: "Land",
    currency: "KRW",
    marketCap: "₩6T",
  },
  {
    symbol: "CAE.TO",
    name: "CAE",
    exchange: "Toronto",
    country: "ca",
    sector: "Simulation",
    currency: "CAD",
    marketCap: "C$28B",
  },
];

/** Look up by companyId (matching data.ts companies array). */
export function findByCompanyId(
  companyId: string,
): DefenceStockSymbol | undefined {
  return defenceStockSymbols.find((s) => s.companyId === companyId);
}

/** Look up by Yahoo Finance symbol. */
export function findBySymbol(
  symbol: string,
): DefenceStockSymbol | undefined {
  return defenceStockSymbols.find((s) => s.symbol === symbol);
}

/** Total number of tracked defence tickers. */
export const STOCK_SYMBOL_COUNT = defenceStockSymbols.length;
