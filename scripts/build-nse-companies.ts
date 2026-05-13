// Build src/data/nse-companies.json from every CSV in data/raw/. Re-run
// any time you add or refresh a source:
//
//   npx tsx scripts/build-nse-companies.ts
//
// The script reads every *.csv file under data/raw/ and merges them
// into a single deduped JSON keyed by ticker symbol. Each CSV must
// have a header row containing "Company Name", "Symbol", and one of
// "Industry" / "Sector" columns. Order of files doesn't matter; later
// rows lose to earlier rows on conflict (so put the more-trusted
// source first alphabetically — e.g. "00-…csv" beats "extras.csv").
//
// Why a script and not a runtime fetch: NSE / niftyindices.com block
// direct fetches with anti-bot headers. We bundle a periodically
// refreshed snapshot instead. To refresh / extend coverage:
//   1. Download the latest CSV from niftyindices.com (Index
//      Constituents → Nifty Total Market / Nifty Smallcap 250 / etc.)
//   2. Drop it into data/raw/
//   3. Re-run this script

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

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

function parseArgs(argv: string[]): { inDir: string; outPath: string } {
  let inDir = "data/raw";
  let outPath = "src/data/nse-companies.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in-dir" && argv[i + 1]) inDir = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) outPath = argv[++i];
  }
  return { inDir, outPath };
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

function processCsvFile(path: string): {
  companies: NseCompany[];
  unmappedIndustries: Set<string>;
} {
  const text = readFileSync(resolve(path), "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { companies: [], unmappedIndustries: new Set() };

  const header = splitCsvLine(lines[0]).map((s) => s.toLowerCase());
  const nameIdx = header.findIndex((h) => h.includes("company") || h === "name");
  const industryIdx = header.findIndex(
    (h) => h.includes("industry") || h.includes("sector") || h.includes("sector_id")
  );
  const symbolIdx = header.findIndex((h) => h.includes("symbol") || h === "ticker");
  if (nameIdx < 0 || symbolIdx < 0) {
    console.error(`Skipping ${path}: missing Company / Symbol columns`);
    return { companies: [], unmappedIndustries: new Set() };
  }

  const companies: NseCompany[] = [];
  const unmappedIndustries = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const name = cells[nameIdx]?.trim();
    const symbol = cells[symbolIdx]?.trim();
    const industry = industryIdx >= 0 ? cells[industryIdx]?.trim() : "";
    if (!name || !symbol) continue;

    const override = SYMBOL_OVERRIDES[symbol.toUpperCase()];
    // Industry column might either be NSE's text classification or a
    // pre-mapped sector_id ("auto", "banking" etc.) from a curated
    // file. Accept both.
    const lc = industry?.toLowerCase() ?? "";
    const isDirectSectorId = /^[a-z]{2,12}$/.test(lc);
    const fromIndustry = INDUSTRY_TO_SECTOR[industry?.toUpperCase()];
    const sector_id =
      override ??
      fromIndustry ??
      (isDirectSectorId ? lc : null);
    if (!sector_id && industry) unmappedIndustries.add(industry);
    companies.push({ name, symbol, sector_id });
  }
  return { companies, unmappedIndustries };
}

function main() {
  const { inDir, outPath } = parseArgs(process.argv.slice(2));
  const files = readdirSync(resolve(inDir))
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  if (files.length === 0) {
    console.error(`No CSV files found in ${inDir}/`);
    process.exit(1);
  }

  // Symbol-keyed dedupe — first-seen wins, so put more-authoritative
  // files alphabetically first if order matters.
  const bySymbol = new Map<string, NseCompany>();
  const allUnmapped = new Set<string>();
  const perFileCounts: { file: string; count: number; mapped: number }[] = [];

  for (const f of files) {
    const path = join(inDir, f);
    const { companies, unmappedIndustries } = processCsvFile(path);
    let added = 0;
    let mappedAdded = 0;
    for (const c of companies) {
      const key = c.symbol.toUpperCase();
      if (bySymbol.has(key)) continue;
      bySymbol.set(key, c);
      added += 1;
      if (c.sector_id) mappedAdded += 1;
    }
    for (const u of unmappedIndustries) allUnmapped.add(u);
    perFileCounts.push({ file: f, count: added, mapped: mappedAdded });
  }

  const out = Array.from(bySymbol.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  writeFileSync(resolve(outPath), JSON.stringify(out, null, 2) + "\n", "utf8");
  const mapped = out.filter((x) => x.sector_id).length;
  console.log(
    `Wrote ${out.length} unique companies (${mapped} mapped, ${out.length - mapped} unmapped) → ${outPath}`
  );
  for (const r of perFileCounts) {
    console.log(`  + ${r.file}: ${r.count} new (${r.mapped} mapped)`);
  }
  if (allUnmapped.size > 0) {
    console.log("Unmapped industries:", Array.from(allUnmapped).join(", "));
  }
}

main();
