// Minimal parser for the MUNS event-stream response.
//
// The MUNS /agents/run endpoint returns a single text body that looks like:
//
//   HTTP/2 200
//   ...headers...
//
//   <task>
//   <1>
//   <tool><s>...</s></tool>
//   ...
//   <ans>Date | Headline | Source | ... | Link
//   ---|---|---|---
//   28-Apr-2026 | ... | https://...
//   ...
//   </ans>
//   </1>
//   </task>
//
// Only the table inside <ans>...</ans> is the actual deliverable. Everything
// else (HTTP headers, tool traces, task tags) is noise.

export interface MunsNewsRow {
  date: string;
  headline: string;
  source: string;
  link: string;
  raw: Record<string, string>;
}

const stripBold = (value: string) => value.replace(/\*\*/g, "").trim();

const parseCells = (line: string): string[] =>
  line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const isSeparatorRow = (line: string) =>
  /^\|?[\s|\-:]+\|?$/.test(line) && line.includes("-");

const findColumn = (
  columns: string[],
  ...needles: string[]
): string | undefined =>
  columns.find((col) => {
    const lower = col.toLowerCase();
    return needles.some((needle) => lower.includes(needle));
  });

export const extractAnswerBlock = (raw: string): string | null => {
  const startIdx = raw.indexOf("<ans>");
  if (startIdx === -1) return null;
  const endIdx = raw.indexOf("</ans>", startIdx);
  const body = endIdx === -1 ? raw.slice(startIdx + 5) : raw.slice(startIdx + 5, endIdx);
  return body.trim();
};

export const parseMunsTable = (
  raw: string,
): { columns: string[]; rows: Record<string, string>[] } | null => {
  const block = extractAnswerBlock(raw);
  if (!block) return null;

  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;
  if (!isSeparatorRow(lines[1])) return null;

  const columns = parseCells(lines[0]).map(stripBold);
  const rows = lines.slice(2).map((line) => {
    const cells = parseCells(line);
    const row: Record<string, string> = {};
    columns.forEach((col, idx) => {
      row[col] = stripBold(cells[idx] || "");
    });
    return row;
  });

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
