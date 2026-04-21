/**
 * Parse CSV metadata and map tip labels to category colors.
 */

export interface MetadataTable {
  headers: string[];
  rows: Record<string, string>[];  // each row keyed by header name
}

export interface TipColorMap {
  colorByTip: Map<string, string>;  // tip name → hex color
  categoryByTip: Map<string, string>;  // tip name → category name
  legend: { category: string; color: string }[];
  /** Display name override: tip ID → label to show in the tree */
  displayNameByTip?: Map<string, string>;
}

// 10-color categorical palette (Tableau10, accessible and distinguishable)
const CATEGORY_COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

/** Parse a CSV string into a table. Handles quoted fields and common delimiters. */
export function parseCSV(text: string): MetadataTable {
  // Strip BOM; trim only trailing whitespace (trimming the start would destroy
  // a leading-tab signal used by R/Excel row-name exports).
  const cleaned = text.replace(/^\uFEFF/, '').trimEnd();
  const allLines = cleaned.split(/\r\n|\r|\n/);
  // Skip any leading blank lines so the first non-empty line is the header.
  const firstNonEmpty = allLines.findIndex((l) => l.trim() !== '');
  const lines = firstNonEmpty > 0 ? allLines.slice(firstNonEmpty) : allLines;
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Detect delimiter: try tab first, then comma
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const rawHeaders = parseLine(lines[0], delimiter);

  // Strip a leading empty column — common in R/Excel exports that include row
  // names (the row-name column has no header, producing a leading empty field).
  const hasLeadingEmpty = rawHeaders[0] === '';
  const headers = hasLeadingEmpty ? rawHeaders.slice(1) : rawHeaders;

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let values = parseLine(line, delimiter);

    // Align data rows with (possibly trimmed) headers:
    // If the header had a leading empty field, drop the first data field too.
    // If the header had no leading empty but data has one extra field at the
    // start that is empty or a plain integer (row index), drop it as well.
    if (hasLeadingEmpty) {
      if (values.length > headers.length) values = values.slice(1);
    } else if (values.length === headers.length + 1) {
      const first = values[0];
      if (first === '' || /^\d+$/.test(first)) values = values.slice(1);
    }

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

/** Build a color map from a metadata table, given the ID, category, and optional display name columns. */
export function buildTipColorMap(
  table: MetadataTable,
  idColumn: string,
  categoryColumn: string,
  nameColumn?: string
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

  // Build tip → color and tip → category maps
  const colorByTip = new Map<string, string>();
  const categoryByTip = new Map<string, string>();
  for (const row of table.rows) {
    const tipId = row[idColumn];
    const cat = row[categoryColumn];
    if (tipId && cat) {
      const color = categoryColorMap.get(cat);
      if (color) {
        colorByTip.set(tipId, color);
        categoryByTip.set(tipId, cat);
      }
    }
  }

  const legend = categoryList.map((cat) => ({
    category: cat,
    color: categoryColorMap.get(cat)!,
  }));

  // Build display name map if a name column is specified
  let displayNameByTip: Map<string, string> | undefined;
  if (nameColumn && nameColumn !== idColumn) {
    displayNameByTip = new Map<string, string>();
    for (const row of table.rows) {
      const tipId = row[idColumn];
      const displayName = row[nameColumn];
      if (tipId && displayName) {
        displayNameByTip.set(tipId, displayName);
      }
    }
  }

  return { colorByTip, categoryByTip, legend, displayNameByTip };
}

/** Re-assign palette colors to only the visible categories, starting from palette index 0.
 *  When a tree is pruned or filtered, this ensures visible categories use the most
 *  distinguishable colors rather than retaining their positions in the full palette.
 *
 *  Visibility is tracked by CATEGORY NAME (not color), so the result is correct even
 *  when >10 categories cause the palette to wrap and two categories share a color. */
export function recolorForVisibleTips(
  tcm: TipColorMap,
  visibleTipNames: Iterable<string>
): TipColorMap {
  // Collect the set of visible category names by looking up each tip's category.
  const visibleCategories = new Set<string>();
  const catByTip = tcm.categoryByTip;
  for (const name of visibleTipNames) {
    const cat = catByTip.get(name)
      ?? catByTip.get(name.replace(/_/g, ' '))
      ?? catByTip.get(name.replace(/ /g, '_'));
    if (cat) visibleCategories.add(cat);
  }

  const visibleLegend = tcm.legend.filter((item) => visibleCategories.has(item.category));
  // All categories already visible — return unchanged (no recoloring needed)
  if (visibleLegend.length === tcm.legend.length) return tcm;
  // No visible tip matches any metadata entry — suppress legend entirely
  if (visibleLegend.length === 0) {
    return { colorByTip: new Map(), categoryByTip: new Map(), legend: [], displayNameByTip: tcm.displayNameByTip };
  }

  // Assign new palette colors to visible categories (starting from index 0).
  const categoryToNewColor = new Map<string, string>();
  visibleLegend.forEach((item, i) => {
    categoryToNewColor.set(item.category, CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
  });

  // Build new colorByTip from the category→newColor mapping (no color-collision risk).
  const newColorByTip = new Map<string, string>();
  for (const [tip, cat] of catByTip) {
    const newColor = categoryToNewColor.get(cat);
    if (newColor !== undefined) newColorByTip.set(tip, newColor);
  }

  const newLegend = visibleLegend.map((item, i) => ({
    category: item.category,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  return { colorByTip: newColorByTip, categoryByTip: catByTip, legend: newLegend, displayNameByTip: tcm.displayNameByTip };
}
