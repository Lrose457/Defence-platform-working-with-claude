/**
 * Test-fixture data for the Defence Intelligence Platform.
 *
 * This file contains hand-curated demo data used for development and
 * UI testing.  In production, ALL data must come from the live ingestion
 * pipeline (Supabase tables and views).  The exports below are gated
 * behind the `NEXT_PUBLIC_USE_DEMO_DATA` environment variable so that
 * demo data is never served in production.
 *
 * Pages and components that import from this file will receive empty
 * arrays when demo mode is disabled.  They are expected to render a
 * "no data available" state or redirect to the live data API.
 *
 * @see lib/evidenceLevels.ts — evidence-level taxonomy and isDemoDataEnabled()
 */

const DEMO_MODE =
  process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true";

function demoOrEmpty<T>(data: T[]): T[] {
  return DEMO_MODE ? data : [];
}

export interface Source {
  id: string;
  name: string;
  type: 'Government' | 'Intelligence Agency' | 'OSINT' | 'Commercial' | 'Whistleblower';
  reliability: 'High' | 'Medium' | 'Low';
  description: string;
}

export interface Company {
  id: string;
  name: string;
  countryId: string;
  contractsCount: number;
  description: string;
  headquarters: string;
  ceo: string;
  marketCap: string;
  strategicAssessment?: string;
}

export interface Contract {
  id: string;
  title: string;
  companyId: string;
  countryId: string;
  value: string;
  confidenceScore: number; // 1-5
  lastUpdated: string; // ISO date
  status: 'Proposed' | 'Debated' | 'Passed' | 'Funded';
  description: string;
  sourceId: string;
}

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  region: string;
  spending: string;
  lastUpdated: string;
  defenceBudgetTrend: 'Increasing' | 'Decreasing' | 'Stable';
  blocs: string[]; // Added for power bloc mapping
  spendingHistory: { year: string; value: number }[];
  strategicAssessment?: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  role: string;
  countryId: string;
  companyId: string;
  confidenceScore: number;
  specs: Record<string, string | undefined>;
  sourceId: string;
}

export interface Conflict {
  id: string;
  name: string;
  region: string;
  startDate: string;
  status: 'Active' | 'Frozen' | 'Resolved';
  summary: string;
  tacticalAnalysis: {
    primaryWeapon: string;
    primaryTarget: string;
    attackTrend: 'Increasing' | 'Decreasing' | 'Stable';
  };
  hotspots: { city: string; count: number }[];
  financialCorrelation: {
    spendingSurged: boolean;
    relatedBudgetIncrease: string;
  };
  lossTable: {
    side: string;
    personnel: string;
    tanks: string;
    aircraft: string;
    ships: string;
  }[];
}

export interface Legislation {
  id: string;
  title: string;
  body: string; // e.g., 'UK Parliament', 'US Congress'
  status: 'Proposed' | 'Debated' | 'Passed' | 'Funded';
  date: string;
  impact: 'High' | 'Medium' | 'Low';
  description: string;
  sourceId: string;
}

export interface CountryIntelligence {
  events: number;
  fatalities: number;
  spendingGrowth: string;
}

export const sources: Source[] = demoOrEmpty([
  { id: 'src-1', name: 'MOD Budget Office', type: 'Government', reliability: 'High', description: 'Official UK Ministry of Defence financial reports.' },
  { id: 'src-2', name: 'SIPRI Database', type: 'Commercial', reliability: 'High', description: 'Stockholm International Peace Research Institute.' },
  { id: 'src-3', name: 'Janes Defence', type: 'Commercial', reliability: 'High', description: 'Leading provider of military intelligence.' },
  { id: 'src-4', name: 'Intel-OSINT Feed', type: 'OSINT', reliability: 'Medium', description: 'Aggregated satellite and social media intelligence.' },
  { id: 'src-5', name: 'Agency Leak-X', type: 'Whistleblower', reliability: 'Low', description: 'Unverified internal document leaks.' },
]);

export const companies: Company[] = demoOrEmpty([
  { id: 'comp-1', name: 'Lockheed Martin', countryId: 'us', contractsCount: 150, description: 'World largest defence contractor, focused on aerospace and advanced systems.', headquarters: 'Bethesda, MD, USA', ceo: 'Jim Taiclet', marketCap: '$110B', strategicAssessment: 'Dominant in stealth and multi-role combat; currently pivoting toward JADC2 (Joint All-Domain Command and Control) and autonomous swarm tech.' },
  { id: 'comp-2', name: 'Northrop Grumman', countryId: 'us', contractsCount: 90, description: 'Specialists in stealth bombers and nuclear deterrence.', headquarters: 'Falls Church, VA, USA', ceo: 'Kathy Warden', marketCap: '$65B', strategicAssessment: 'Cornerstone of the US nuclear triad; critical focus on the B-21 Raider and strategic deterrence systems.' },
  { id: 'comp-3', name: 'Raytheon Technologies', countryId: 'us', contractsCount: 110, description: 'Leaders in missiles, sensors, and aviation.', headquarters: 'Waltham, MA, USA', ceo: 'Christopher Calio', marketCap: '$120B', strategicAssessment: 'Pivot toward hypersonic interceptors and integrated air and missile defence (IAMD) across NATO.' },
  { id: 'comp-4', name: 'General Dynamics', countryId: 'us', contractsCount: 80, description: 'Focus on naval ships and land combat vehicles.', headquarters: 'Reston, VA, USA', ceo: 'Phebe Novakovic', marketCap: '$75B' },
  { id: 'comp-5', name: 'BAE Systems', countryId: 'uk', contractsCount: 45, description: 'UK primary defence prime, strong in naval and aerospace.', headquarters: 'London, UK', ceo: 'Charles Woodburn', marketCap: '£32B' },
  { id: 'comp-6', name: 'Rolls-Royce', countryId: 'uk', contractsCount: 30, description: 'Specialists in nuclear propulsion and aero-engines.', headquarters: 'Derby, UK', ceo: 'Tufan Erginbilgiç', marketCap: '£40B' },
  { id: 'comp-7', name: 'Thales', countryId: 'fr', contractsCount: 40, description: 'Global leader in electrical systems and defence.', headquarters: 'Paris, France', ceo: 'Patrice Mérot', marketCap: '€28B' },
  { id: 'comp-8', name: 'Airbus Defence & Space', countryId: 'de', contractsCount: 35, description: 'European aerospace leader.', headquarters: 'Munich, Germany', ceo: 'Michael Nick Figure', marketCap: '€100B (Group)' },
  { id: 'comp-9', name: 'Rheinmetall', countryId: 'de', contractsCount: 30, description: 'Leaders in land combat and ammunition.', headquarters: 'Düsseldorf, Germany', ceo: 'Armin Papahristou', marketCap: '€15B' },
  { id: 'comp-10', name: 'Leonardo', countryId: 'it', contractsCount: 25, description: 'Italian aerospace and defence giant.', headquarters: 'Rome, Italy', ceo: 'Roberto Cingolani', marketCap: '€12B' },
  { id: 'comp-11', name: 'Mitsubishi Heavy Industries', countryId: 'jp', contractsCount: 20, description: 'Japan primary defence and aerospace prime.', headquarters: 'Tokyo, Japan', ceo: 'Seiji Izumisawa', marketCap: '¥4T' },
  { id: 'comp-12', name: 'Hanwha Aerospace', countryId: 'kr', contractsCount: 25, description: 'South Korean leader in artillery and aerospace.', headquarters: 'Seoul, South Korea', ceo: 'Chan-Koo Shin', marketCap: '₩12T' },
  { id: 'comp-13', name: 'AVIC', countryId: 'cn', contractsCount: 100, description: 'State-owned Chinese aerospace giant.', headquarters: 'Beijing, China', ceo: 'State Appointed', marketCap: 'Classified' },
]);

export const contracts: Contract[] = demoOrEmpty([
  { id: 'cont-1', title: 'Type 26 Frigate Programme', companyId: 'comp-5', countryId: 'uk', value: '$4.2B', confidenceScore: 5, lastUpdated: '2026-09-15', status: 'Funded', description: 'Advanced anti-submarine warfare frigates for the Royal Navy.', sourceId: 'src-1' },
  { id: 'cont-2', title: 'F-35 Procurement', companyId: 'comp-1', countryId: 'us', value: '$9.8B', confidenceScore: 5, lastUpdated: '2026-09-10', status: 'Funded', description: 'Fifth-generation stealth multi-role fighter.', sourceId: 'src-2' },
  { id: 'cont-3', title: 'Artillery Systems', companyId: 'comp-9', countryId: 'de', value: '$1.7B', confidenceScore: 4, lastUpdated: '2026-09-18', status: 'Passed', description: 'Modernization of heavy artillery and ammunition production.', sourceId: 'src-3' },
  { id: 'cont-4', title: 'Air Defence Systems', companyId: 'comp-7', countryId: 'fr', value: '$850M', confidenceScore: 3, lastUpdated: '2026-09-12', status: 'Debated', description: 'Next-gen surface-to-air missile systems for EU partners.', sourceId: 'src-4' },
]);

export const countries: Country[] = demoOrEmpty([
  { id: 'uk', name: 'United Kingdom', iso_code: 'GBR', region: 'Europe', spending: '$65B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO', 'G7'], spendingHistory: [{year: '2021', value: 50}, {year: '2022', value: 55}, {year: '2023', value: 58}, {year: '2024', value: 62}, {year: '2025', value: 65}], strategicAssessment: 'Focusing on naval projection (AUKUS) and cyber-defence to maintain global reach despite budgetary constraints.' },
  { id: 'us', name: 'United States', iso_code: 'USA', region: 'North America', spending: '$850B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO', 'G7'], spendingHistory: [{year: '2021', value: 780}, {year: '2022', value: 810}, {year: '2023', value: 830}, {year: '2024', value: 845}, {year: '2025', value: 850}], strategicAssessment: 'Pivoting toward Indo-Pacific deterrence with heavy investment in hypersonic systems and AI-driven command and control.' },
  { id: 'de', name: 'Germany', iso_code: 'DEU', region: 'Europe', spending: '$70B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO', 'EU'], spendingHistory: [{year: '2021', value: 45}, {year: '2022', value: 50}, {year: '2023', value: 60}, {year: '2024', value: 65}, {year: '2025', value: 70}], strategicAssessment: 'Rapidly scaling land-based capabilities (Zeitenwende) to assume a primary security role in Central Europe.' },
  { id: 'fr', name: 'France', iso_code: 'FRA', region: 'Europe', spending: '$60B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: ['NATO', 'EU'], spendingHistory: [{year: '2021', value: 55}, {year: '2022', value: 56}, {year: '2023', value: 58}, {year: '2024', value: 60}, {year: '2025', value: 60}] },
  { id: 'jp', name: 'Japan', iso_code: 'JPN', region: 'Asia', spending: '$50B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['QUAD'], spendingHistory: [{year: '2021', value: 30}, {year: '2022', value: 35}, {year: '2023', value: 40}, {year: '2024', value: 45}, {year: '2025', value: 50}] },
  { id: 'cn', name: 'China', iso_code: 'CHN', region: 'Asia', spending: '$290B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['BRICS', 'SCO'], spendingHistory: [{year: '2021', value: 200}, {year: '2022', value: 220}, {year: '2023', value: 240}, {year: '2024', value: 260}, {year: '2025', value: 290}] },
  { id: 'ru', name: 'Russia', iso_code: 'RUS', region: 'Europe/Asia', spending: '$100B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['BRICS', 'SCO'], spendingHistory: [{year: '2021', value: 40}, {year: '2022', value: 60}, {year: '2023', value: 80}, {year: '2024', value: 90}, {year: '2025', value: 100}] },
  { id: 'in', name: 'India', iso_code: 'IND', region: 'Asia', spending: '$75B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['BRICS', 'QUAD'], spendingHistory: [{year: '2021', value: 60}, {year: '2022', value: 65}, {year: '2023', value: 70}, {year: '2024', value: 72}, {year: '2025', value: 75}] },
  { id: 'kr', name: 'South Korea', iso_code: 'KOR', region: 'Asia', spending: '$45B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: [], spendingHistory: [{year: '2021', value: 40}, {year: '2022', value: 42}, {year: '2023', value: 43}, {year: '2024', value: 45}, {year: '2025', value: 45}] },
  { id: 'au', name: 'Australia', iso_code: 'AUS', region: 'Oceania', spending: '$35B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO-Partner', 'QUAD', 'AUKUS'], spendingHistory: [{year: '2021', value: 25}, {year: '2022', value: 28}, {year: '2023', value: 30}, {year: '2024', value: 32}, {year: '2025', value: 35}] },
  { id: 'ca', name: 'Canada', iso_code: 'CAN', region: 'North America', spending: '$25B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: ['NATO', 'G7'], spendingHistory: [{year: '2021', value: 22}, {year: '2022', value: 23}, {year: '2023', value: 24}, {year: '2024', value: 25}, {year: '2025', value: 25}] },
  { id: 'br', name: 'Brazil', iso_code: 'BRA', region: 'South America', spending: '$20B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: ['BRICS'], spendingHistory: [{year: '2021', value: 18}, {year: '2022', value: 19}, {year: '2023', value: 20}, {year: '2024', value: 20}, {year: '2025', value: 20}] },
  { id: 'sa', name: 'Saudi Arabia', iso_code: 'SAU', region: 'Middle East', spending: '$60B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: [], spendingHistory: [{year: '2021', value: 50}, {year: '2022', value: 52}, {year: '2023', value: 55}, {year: '2024', value: 58}, {year: '2025', value: 60}] },
  { id: 'tr', name: 'Turkey', iso_code: 'TUR', region: 'Europe/Asia', spending: '$30B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO'], spendingHistory: [{year: '2021', value: 20}, {year: '2022', value: 22}, {year: '2023', value: 25}, {year: '2024', value: 28}, {year: '2025', value: 30}] },
  { id: 'is', name: 'Israel', iso_code: 'ISR', region: 'Middle East', spending: '$25B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: [], spendingHistory: [{year: '2021', value: 18}, {year: '2022', value: 20}, {year: '2023', value: 22}, {year: '2024', value: 23}, {year: '2025', value: 25}] },
  { id: 'pl', name: 'Poland', iso_code: 'POL', region: 'Europe', spending: '$32B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: ['NATO', 'EU'], spendingHistory: [{year: '2021', value: 15}, {year: '2022', value: 20}, {year: '2023', value: 25}, {year: '2024', value: 28}, {year: '2025', value: 32}] },
  { id: 'ua', name: 'Ukraine', iso_code: 'UKR', region: 'Europe', spending: '$40B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: [], spendingHistory: [{year: '2021', value: 10}, {year: '2022', value: 20}, {year: '2023', value: 30}, {year: '2024', value: 35}, {year: '2025', value: 40}] },
  { id: 'vn', name: 'Vietnam', iso_code: 'VNM', region: 'Asia', spending: '$10B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: [], spendingHistory: [{year: '2021', value: 8}, {year: '2022', value: 9}, {year: '2023', value: 10}, {year: '2024', value: 10}, {year: '2025', value: 10}] },
  { id: 'sg', name: 'Singapore', iso_code: 'SGP', region: 'Asia', spending: '$15B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Stable', blocs: [], spendingHistory: [{year: '2021', value: 12}, {year: '2022', value: 13}, {year: '2023', value: 14}, {year: '2024', value: 15}, {year: '2025', value: 15}] },
  { id: 'tw', name: 'Taiwan', iso_code: 'TWN', region: 'Asia', spending: '$18B', lastUpdated: '2026-09-01', defenceBudgetTrend: 'Increasing', blocs: [], spendingHistory: [{year: '2021', value: 12}, {year: '2022', value: 14}, {year: '2023', value: 15}, {year: '2024', value: 17}, {year: '2025', value: 18}] }
]);

export const equipment: Equipment[] = demoOrEmpty([
  { id: 'eq-1', name: 'Type 26 Frigate', type: 'Sea', role: 'Anti-Submarine Warfare', countryId: 'uk', companyId: 'comp-5', confidenceScore: 5, specs: { 'Tonnage': '8000t', 'Armament': 'SeaCeptor' }, sourceId: 'src-1' },
  { id: 'eq-2', name: 'F-35 Lightning II', type: 'Air', role: 'Multi-role Stealth', countryId: 'us', companyId: 'comp-1', confidenceScore: 5, specs: { 'Max Speed': 'Mach 1.6', 'Stealth': 'VLO' }, sourceId: 'src-2' },
  { id: 'eq-3', name: 'Leopard 2A7', type: 'Land', role: 'Main Battle Tank', countryId: 'de', companyId: 'comp-9', confidenceScore: 5, specs: { 'Armour': 'Composite', 'Gun': '120mm' }, sourceId: 'src-3' },
  { id: 'eq-4', name: 'SAMP/T', type: 'Air', role: 'Air Defence', countryId: 'fr', companyId: 'comp-7', confidenceScore: 4, specs: { 'Range': '100km+', 'Target': 'Ballistic Missiles' }, sourceId: 'src-4' },
]);

export const conflicts: Conflict[] = demoOrEmpty([
  {
    id: 'conf-1',
    name: 'Russia-Ukraine War',
    region: 'Europe',
    startDate: '2022-02-24',
    status: 'Active',
    summary: 'High-intensity conflict characterized by a shift toward long-range precision strikes and drone warfare.',
    tacticalAnalysis: {
      primaryWeapon: 'FPV Drones / Storm Shadow',
      primaryTarget: 'Logistics Hubs & Command Centres',
      attackTrend: 'Increasing'
    },
    hotspots: [
      { city: 'Kyiv', count: 1240 },
      { city: 'Kharkiv', count: 850 },
      { city: 'Donetsk', count: 2100 },
      { city: 'Mariupol', count: 1100 },
      { city: 'Kherson', count: 600 },
    ],
    financialCorrelation: {
      spendingSurged: true,
      relatedBudgetIncrease: '$120B cumulative surge (est)'
    },
    lossTable: [
      { side: 'Russian Federation', personnel: '150k+', tanks: '2500+', aircraft: '400+', ships: '12' },
      { side: 'Ukraine', personnel: '100k+', tanks: '1200+', aircraft: '150+', ships: '4' },
    ]
  },
  {
    id: 'conf-2',
    name: 'Israel-Hamas War',
    region: 'Middle East',
    startDate: '2023-10-07',
    status: 'Active',
    summary: 'Urban warfare conflict focused on tunnel networks and asymmetric insurgent tactics.',
    tacticalAnalysis: {
      primaryWeapon: 'Precision Air-to-Ground / Tunnels',
      primaryTarget: 'Urban Infrastructure / Command Bunkers',
      attackTrend: 'Increasing'
    },
    hotspots: [
      { city: 'Gaza City', count: 4500 },
      { city: 'Khan Younis', count: 2100 },
      { city: 'Sderot', count: 320 },
    ],
    financialCorrelation: {
      spendingSurged: true,
      relatedBudgetIncrease: 'Emergency military appropriations'
    },
    lossTable: [
      { side: 'Israel', personnel: '1k+', tanks: '50+', aircraft: '0', ships: '0' },
      { side: 'Hamas', personnel: '15k+', tanks: '0', aircraft: '0', ships: '0' },
    ]
  },
  {
    id: 'conf-3',
    name: 'Sudanese Civil War',
    region: 'Africa',
    startDate: '2023-04-15',
    status: 'Active',
    summary: 'Power struggle between SAF and RSF involving intense urban combat and paramilitary operations.',
    tacticalAnalysis: {
      primaryWeapon: 'Technicals / Small Arms',
      primaryTarget: 'Government Buildings / Strategic Bases',
      attackTrend: 'Stable'
    },
    hotspots: [
      { city: 'Khartoum', count: 3200 },
      { city: 'Darfur', count: 1100 },
      { city: 'Port Sudan', count: 150 },
    ],
    financialCorrelation: {
      spendingSurged: false,
      relatedBudgetIncrease: 'Internal resource reallocation'
    },
    lossTable: [
      { side: 'SAF', personnel: '10k+', tanks: '100+', aircraft: '10+', ships: '0' },
      { side: 'RSF', personnel: '12k+', tanks: '200+', aircraft: '0', ships: '0' },
    ]
  },
  {
    id: 'conf-4',
    name: 'Myanmar Civil War',
    region: 'Asia',
    startDate: '2021-02-01',
    status: 'Active',
    summary: 'Multi-front insurgency against the military junta using guerrilla tactics and drone strikes.',
    tacticalAnalysis: {
      primaryWeapon: 'Improvised Drones / Light Infantry',
      primaryTarget: 'Military Junctions / Police Outposts',
      attackTrend: 'Increasing'
    },
    hotspots: [
      { city: 'Naypyidaw', count: 800 },
      { city: 'Mandalay', count: 1100 },
      { city: 'Yangon', count: 1500 },
    ],
    financialCorrelation: {
      spendingSurged: true,
      relatedBudgetIncrease: 'Junta spending increase on internal security'
    },
    lossTable: [
      { side: 'Military Junta', personnel: '20k+', tanks: '300+', aircraft: '50+', ships: '0' },
      { side: 'PDF/EAOs', personnel: '15k+', tanks: '50+', aircraft: '0', ships: '0' },
    ]
  },
  {
    id: 'conf-5',
    name: 'South China Sea Disputes',
    region: 'Asia',
    startDate: '2010-01-01',
    status: 'Frozen',
    summary: 'Strategic maritime dispute involving artificial island construction and naval posturing.',
    tacticalAnalysis: {
      primaryWeapon: 'Naval Vessels / Maritime Militia',
      primaryTarget: 'Maritime Sovereignty / EEZ',
      attackTrend: 'Stable'
    },
    hotspots: [
      { city: 'Spratly Islands', count: 450 },
      { city: 'Paracel Islands', count: 320 },
      { city: 'Scarborough Shoal', count: 110 },
    ],
    financialCorrelation: {
      spendingSurged: true,
      relatedBudgetIncrease: 'Sustained lapped procurement'
    },
    lossTable: [
      { side: 'China', personnel: 'N/A', tanks: '0', aircraft: '0', ships: '2' },
      { side: 'Philippines/Vietnam', personnel: 'N/A', tanks: '0', aircraft: '0', ships: '1' },
    ]
  },
]);

export const legislation: Legislation[] = demoOrEmpty([
  { id: 'leg-1', title: 'Defence Act 2026', body: 'UK Parliament', status: 'Funded', date: '2026-03-12', impact: 'High', description: 'Authorization for increased spending on cyber-defence capabilities.', sourceId: 'src-1' },
  { id: 'leg-2', title: 'EU Strategic Compass 2.0', body: 'European Council', status: 'Passed', date: '2026-05-20', impact: 'Medium', description: 'Standardization of military equipment across EU member states.', sourceId: 'src-2' },
  { id: 'leg-3', title: 'National Defence Authorization Act', body: 'US Congress', status: 'Debated', date: '2026-09-01', impact: 'High', description: 'Funding for hypersonic missile research and development.', sourceId: 'src-3' },
]);

export const countryIntelligence: { [key: string]: CountryIntelligence } =
  DEMO_MODE
    ? {
        "uk": { events: 1240, fatalities: 45, spendingGrowth: "+4.2%" },
        "us": { events: 8500, fatalities: 120, spendingGrowth: "+3.1%" },
        "de": { events: 3200, fatalities: 10, spendingGrowth: "+8.5%" },
        "fr": { events: 2100, fatalities: 22, spendingGrowth: "+2.1%" },
        "cn": { events: 15000, fatalities: 400, spendingGrowth: "+6.8%" },
        "ru": { events: 45000, fatalities: 25000, spendingGrowth: "+12.4%" },
      }
    : {};
