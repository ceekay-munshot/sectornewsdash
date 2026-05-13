// Build src/data/nse-companies.json from a Nifty 500 / NSE equity master
// CSV. Re-run whenever the upstream list changes:
//
//   npx tsx scripts/build-nse-companies.ts \
//     --in data/raw/ind_nifty500list.csv \
//     --out src/data/nse-companies.json
//
// Default args (no flags) use the paths above.
//
// Why a script and not a runtime fetch: NSE / niftyindices.com aggressively
// block direct fetches with anti-bot headers. We bundle a periodically
// refreshed snapshot instead. To refresh: download the latest CSV from
// niftyindices.com (Index Constituents → Nifty 500), drop it into
// data/raw/ind_nifty500list.csv, and re-run this script.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// NSE Industry → our sector_id. Where one NSE industry could plausibly
// map to multiple sectors (FINANCIAL SERVICES → banks vs NBFC; SERVICES
// → logistics vs hotels vs aviation), the symbol-specific override map
// below decides on a finer split.
const INDUSTRY_TO_SECTOR: Record<string, string> = {
  AUTOMOBILE: "auto",
  "CEMENT & CEMENT PRODUCTS": "cement",
  CHEMICALS: "chemicals",
  CONSTRUCTION: "infra",
  "CONSUMER GOODS": "fmcg",
  ENERGY: "energy",
  "FERTILISERS & PESTICIDES": "agri",
  "FINANCIAL SERVICES": "banking",
  "HEALTHCARE SERVICES": "healthcare",
  "INDUSTRIAL MANUFACTURING": "capgoods",
  IT: "it",
  "MEDIA & ENTERTAINMENT": "media",
  METALS: "metals",
  PAPER: "capgoods",
  PHARMA: "pharma",
  SERVICES: "logistics",
  TELECOM: "telecom",
  TEXTILES: "textiles",
};

// Symbol-level overrides for cases the industry-level mapping gets
// wrong. Driven by what an investor would expect, not strict NSE
// taxonomy. Keys are the NSE SYMBOL column (case-insensitive).
const SYMBOL_OVERRIDES: Record<string, string> = {
  // Banks vs NBFC vs Insurance vs Misc-financials
  BAJFINANCE: "nbfc",
  BAJAJFINSV: "nbfc",
  BAJAJHLDNG: "nbfc",
  CHOLAFIN: "nbfc",
  CHOLAHLDNG: "nbfc",
  "M&MFIN": "nbfc",
  MANAPPURAM: "nbfc",
  MUTHOOTFIN: "nbfc",
  PFC: "nbfc",
  RECLTD: "nbfc",
  HUDCO: "nbfc",
  SRTRANSFIN: "nbfc",
  SUNDARMFIN: "nbfc",
  LICHSGFIN: "nbfc",
  PNBHOUSING: "nbfc",
  IBULHSGFIN: "nbfc",
  CANFINHOME: "nbfc",
  GRUH: "nbfc",
  AAVAS: "nbfc",
  REPCOHOME: "nbfc",
  IDFC: "nbfc",
  "L&TFH": "nbfc",
  MASFIN: "nbfc",
  CREDITACC: "nbfc",
  EDELWEISS: "nbfc",
  JMFINANCIL: "nbfc",
  MOTILALOFS: "nbfc",
  RNAM: "nbfc",
  ISEC: "nbfc",
  HDFCAMC: "nbfc",
  HDFC: "nbfc",
  RELCAPITAL: "nbfc",
  RHFL: "nbfc",
  DHFL: "nbfc",
  IFCI: "nbfc",
  SREINFRA: "nbfc",
  INDOSTAR: "nbfc",
  MAGMA: "nbfc",
  ABCAPITAL: "nbfc",
  IBVENTURES: "nbfc",
  IEX: "nbfc",
  BSE: "nbfc",
  CDSL: "nbfc",
  CARERATING: "nbfc",
  CRISIL: "nbfc",
  ICRA: "nbfc",
  TATAINVEST: "nbfc",
  EQUITAS: "nbfc",
  UJJIVAN: "nbfc",

  HDFCLIFE: "insurance",
  ICICIGI: "insurance",
  ICICIPRULI: "insurance",
  SBILIFE: "insurance",
  GICRE: "insurance",
  NIACL: "insurance",
  MFSL: "insurance",

  // Defence
  BEL: "defence",
  HAL: "defence",
  BEML: "defence",
  BDL: "defence",
  COCHINSHIP: "defence",

  // Renewables / wind / solar
  SUZLON: "renewables",
  INOXWIND: "renewables",
  ADANIGREEN: "renewables",

  // Power utilities
  NTPC: "power",
  TATAPOWER: "power",
  ADANIPOWER: "power",
  ADANITRANS: "power",
  NHPC: "power",
  SJVN: "power",
  JSWENERGY: "power",
  CESC: "power",
  TORNTPOWER: "power",
  POWERGRID: "power",
  RPOWER: "power",
  RELINFRA: "power",
  KALPATPOWR: "power",
  NLCINDIA: "power",
  PTC: "power",
  NBVENTURES: "power",

  // Real estate
  DLF: "realestate",
  GODREJPROP: "realestate",
  OBEROIRLTY: "realestate",
  PHOENIXLTD: "realestate",
  PRESTIGE: "realestate",
  BRIGADE: "realestate",
  SOBHA: "realestate",
  SUNTECK: "realestate",
  KOLTEPATIL: "realestate",
  IBREALEST: "realestate",
  OMAXE: "realestate",

  // Hospitality (hotels / leisure)
  INDHOTEL: "hospitality",
  EIHOTEL: "hospitality",
  LEMONTREE: "hospitality",
  MHRIL: "hospitality",
  THOMASCOOK: "hospitality",
  "COX&KINGS": "hospitality",
  ITDC: "hospitality",
  DELTACORP: "hospitality",
  INOXLEISUR: "hospitality",
  PVR: "hospitality",

  // Aviation
  INDIGO: "aviation",
  JETAIRWAYS: "aviation",

  // Logistics / shipping / ports
  CONCOR: "logistics",
  ALLCARGO: "logistics",
  BLUEDART: "logistics",
  VRLLOG: "logistics",
  MAHLOG: "logistics",
  GDL: "logistics",
  GPPL: "logistics",
  GESHIP: "logistics",
  SCI: "logistics",
  ADANIPORTS: "logistics",

  // Retail
  DMART: "retail",
  TRENT: "retail",
  FRETAIL: "retail",
  FLFL: "retail",
  SHOPERSTOP: "retail",
  VMART: "retail",
  ABFRL: "retail",

  // Speciality chemicals (vs commodity chemicals)
  PIDILITIND: "specchem",
  VINATIORGA: "specchem",
  NAVINFLUOR: "specchem",
  ATUL: "specchem",
  DEEPAKNTR: "specchem",
  FINEORG: "specchem",
  GALAXYSURF: "specchem",
  SUDARSCHEM: "specchem",
  PIIND: "specchem",
  SRF: "specchem",
  SOLARINDS: "specchem",
  LINDEINDIA: "specchem",

  // Specialty / industrial moves to capgoods default; leave SERVICES'
  // miscellaneous SaaS-y names in IT-adjacent roles as logistics so they
  // bucket cleanly. The dashboard's "logistics" sector covers business
  // services like 3MINDIA / QUESS / TEAMLEASE / NESCO too.
};

interface NseCompany {
  name: string;
  symbol: string;
  sector_id: string | null;
}

function parseArgs(argv: string[]): { inPath: string; outPath: string } {
  let inPath = "data/raw/ind_nifty500list.csv";
  let outPath = "src/data/nse-companies.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in" && argv[i + 1]) inPath = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) outPath = argv[++i];
  }
  return { inPath, outPath };
}

function splitCsvLine(line: string): string[] {
  // Tolerate quoted commas (rare here, but cheap to handle).
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function main() {
  const { inPath, outPath } = parseArgs(process.argv.slice(2));
  const text = readFileSync(resolve(inPath), "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    console.error("Empty input");
    process.exit(1);
  }
  // Expect first row = header
  const header = splitCsvLine(lines[0]).map((s) => s.toLowerCase());
  const nameIdx = header.findIndex((h) => h.includes("company"));
  const industryIdx = header.findIndex((h) => h.includes("industry"));
  const symbolIdx = header.findIndex((h) => h.includes("symbol"));
  if (nameIdx < 0 || symbolIdx < 0) {
    console.error("Could not locate Company Name / Symbol columns");
    process.exit(1);
  }

  const out: NseCompany[] = [];
  const unmappedIndustries = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const name = cells[nameIdx]?.trim();
    const symbol = cells[symbolIdx]?.trim();
    const industry = industryIdx >= 0 ? cells[industryIdx]?.trim() : "";
    if (!name || !symbol) continue;

    const override = SYMBOL_OVERRIDES[symbol.toUpperCase()];
    const defaultSector = INDUSTRY_TO_SECTOR[industry?.toUpperCase()] ?? null;
    const sector_id = override ?? defaultSector;
    if (!sector_id && industry) unmappedIndustries.add(industry);
    out.push({ name, symbol, sector_id });
  }

  writeFileSync(resolve(outPath), JSON.stringify(out, null, 2) + "\n", "utf8");
  const mapped = out.filter((x) => x.sector_id).length;
  console.log(
    `Wrote ${out.length} companies (${mapped} mapped, ${out.length - mapped} unmapped) → ${outPath}`
  );
  if (unmappedIndustries.size > 0) {
    console.log("Unmapped industries:", Array.from(unmappedIndustries).join(", "));
  }
}

main();
