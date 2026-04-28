// Minimal, defensive parser for MUNS event-stream responses.
//
// The /agents/run endpoint returns a single text body shaped like:
//
//   HTTP/2 200
//   ...headers...
//
//   <task>
//   <1>
//   <tool><s>...</s></tool>
//   ...
//   <ans>| Date | Headline | Source | ... | Link |
//   |---|---|---|---|---|
//   | 28-Apr-2026 | ... | https://... |
//   ...
//   </ans>
//   </1>
//   </task>
//   <summary>...optional prose...</summary>
//
// Only the markdown table (typically inside <ans>...</ans>, but we don't
// require those tags) is the user-visible deliverable. The parser is
// intentionally tolerant of:
//   - leading/trailing pipes vs none
//   - `<ans>` prefix on the header line
//   - `</ans>` (and other tags) on the same line as the last data row
//   - extra prose, tool noise, or summary blocks after the table
//   - rows whose cell count differs from the header (skipped, not fatal)
//   - varying date formats (28-Apr-2026, 2026-04-28, etc.)

export interface MunsNewsRow {
  date: string;
  headline: string;
  source: string;
  link: string;
  raw: Record<string, string>;
}

export interface ParsedTable {
  columns: string[];
  rows: Record<string, string>[];
}

const stripBold = (value: string) =>
  value.replace(/\*\*/g, "").replace(/^<ans>\s*/i, "").trim();

const parseCells = (line: string): string[] =>
  line
    .replace(/^<ans>\s*/i, "")
    .replace(/\s*<\/ans>\s*$/i, "")
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

// A markdown-table separator row, e.g. "|---|---|" or "---|---|---" or
// "| :--- | ---: | :---: |".
const isSeparatorRow = (line: string) => {
  if (!line.includes("-")) return false;
  const stripped = line.replace(/^\|/, "").replace(/\|$/, "").trim();
  return /^[\s|\-:]+$/.test(stripped) && stripped.length > 0;
};

const isTableRow = (line: string) => {
  // A real data row contains at least one `|` separator AND isn't a tag-only
  // line. We allow lines that end with `</ans>` or similar trailing tags.
  if (!line.includes("|")) return false;
  if (/^<\/?(task|tool|summary|doc_source|graph|persisted-output|\d+)\b/i.test(line)) {
    return false;
  }
  return true;
};

const findColumn = (
  columns: string[],
  ...needles: string[]
): string | undefined =>
  columns.find((col) => {
    const lower = col.toLowerCase();
    return needles.some((needle) => lower.includes(needle));
  });

export const parseMunsTable = (raw: string): ParsedTable | null => {
  // Split on raw newlines, trim, drop blanks. We do NOT require an <ans>
  // marker — the table is found by locating the separator row, which is the
  // most distinctive line in any markdown table.
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sepIdx = lines.findIndex(isSeparatorRow);
  if (sepIdx < 1) return null;

  // Header is the immediately preceding line. May carry an <ans> prefix.
  const headerLine = lines[sepIdx - 1];
  const columns = parseCells(headerLine).map(stripBold);
  if (columns.length < 2) return null;

  const rows: Record<string, string>[] = [];
  for (let i = sepIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isTableRow(line)) break; // table ends at first non-row line

    const cells = parseCells(line).map(stripBold);
    // Be lenient: pad short rows, truncate long rows.
    if (cells.length < 2) continue;
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col] = cells[idx] || "";
    });
    rows.push(row);
  }

  return { columns, rows };
};

export const parseMunsAutoNews = (raw: string): MunsNewsRow[] => {
  const table = parseMunsTable(raw);
  if (!table) return [];

  const dateCol = findColumn(table.columns, "date");
  const headlineCol = findColumn(table.columns, "headline", "investor", "title");
  const sourceCol = findColumn(table.columns, "source");
  const linkCol = findColumn(table.columns, "link", "url");

  return table.rows
    .map((row) => ({
      date: dateCol ? row[dateCol] || "" : "",
      headline: headlineCol ? row[headlineCol] || "" : "",
      source: sourceCol ? row[sourceCol] || "" : "",
      link: linkCol ? row[linkCol] || "" : "",
      raw: row,
    }))
    .filter((r) => r.headline.length > 0);
};
