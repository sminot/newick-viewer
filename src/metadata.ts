/**
 * Parse CSV metadata and map tip labels to category colors.
 */

export interface MetadataTable {
  headers: string[];
  rows: Record<string, string>[];  // each row keyed by header name
}

export interface TipColorMap {
  colorByTip: Map<string, string>;  // tip name → hex color
  legend: { category: string; color: string }[];
}

// 10-color categorical palette (Tableau10, accessible and distinguishable)
const CATEGORY_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

/** Parse a CSV string into a table. Handles quoted fields and common delimiters. */
export function parseCSV(text: string): MetadataTable {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Detect delimiter: try tab first, then comma
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const headers = parseLine(lines[0], delimiter);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseLine(line, delimiter);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Parse a single CSV line, handling quoted fields */
function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Build a color map from a metadata table, given the ID and category columns. */
export function buildTipColorMap(
  table: MetadataTable,
  idColumn: string,
  categoryColumn: string
): TipColorMap {
  const categories = new Set<string>();
  for (const row of table.rows) {
    const cat = row[categoryColumn];
    if (cat) categories.add(cat);
  }

  // Assign colors to categories
  const categoryList = [...categories].sort();
  const categoryColorMap = new Map<string, string>();
  categoryList.forEach((cat, i) => {
    categoryColorMap.set(cat, CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
  });

  // Build tip → color map
  const colorByTip = new Map<string, string>();
  for (const row of table.rows) {
    const tipId = row[idColumn];
    const cat = row[categoryColumn];
    if (tipId && cat) {
      const color = categoryColorMap.get(cat);
      if (color) colorByTip.set(tipId, color);
    }
  }

  const legend = categoryList.map((cat) => ({
    category: cat,
    color: categoryColorMap.get(cat)!,
  }));

  return { colorByTip, legend };
}
