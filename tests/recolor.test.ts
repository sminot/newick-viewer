/**
 * Red-team edge-case tests for recolorForVisibleTips.
 *
 * Core invariants that must hold after every filter:
 *   I1. Legend contains ONLY categories that have at least one visible tip.
 *   I2. For every visible tip that has metadata, its color in colorByTip
 *       matches the color shown for its category in the legend.
 *   I3. No category appears in the legend with a color different from what
 *       visible tips of that category receive.
 */

import { describe, it, expect } from 'vitest';
import { buildTipColorMap, recolorForVisibleTips } from '../src/metadata';
import { parseCSV } from '../src/metadata';

// Palette exported for tests so we can derive expected values.
// Must stay in sync with CATEGORY_COLORS in metadata.ts.
const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

/** Build a simple TipColorMap from parallel arrays. */
function makeMap(tips: string[], categories: string[]) {
  const csv = ['tip,cat', ...tips.map((t, i) => `${t},${categories[i]}`)].join('\n');
  return buildTipColorMap(parseCSV(csv), 'tip', 'cat');
}

// ---------------------------------------------------------------------------
// Helper: verify invariants I1–I3 for an activeTcm against a visible tip set.
// ---------------------------------------------------------------------------
function assertConsistent(
  activeTcm: ReturnType<typeof recolorForVisibleTips>,
  originalTcm: ReturnType<typeof buildTipColorMap>,
  visibleTips: string[]
) {
  const colorByTip = activeTcm.colorByTip;
  const legend = activeTcm.legend;

  // Build expected visible categories from the visible tip set.
  const expectedVisibleCats = new Set<string>();
  for (const tip of visibleTips) {
    const cat = originalTcm.categoryByTip?.get(tip)
      ?? originalTcm.categoryByTip?.get(tip.replace(/_/g, ' '))
      ?? originalTcm.categoryByTip?.get(tip.replace(/ /g, '_'));
    if (cat) expectedVisibleCats.add(cat);
  }

  // I1: legend must contain exactly the visible categories (no more, no fewer).
  const legendCats = new Set(legend.map(l => l.category));
  for (const cat of legendCats) {
    expect(expectedVisibleCats.has(cat), `I1: legend category "${cat}" has no visible tips`).toBe(true);
  }
  for (const cat of expectedVisibleCats) {
    expect(legendCats.has(cat), `I1: visible category "${cat}" missing from legend`).toBe(true);
  }

  // Build legend color lookup.
  const legendColorForCat = new Map(legend.map(l => [l.category, l.color]));

  // I2 + I3: for each visible tip with metadata, tip color == legend color for its category.
  for (const tip of visibleTips) {
    const cat = originalTcm.categoryByTip?.get(tip)
      ?? originalTcm.categoryByTip?.get(tip.replace(/_/g, ' '))
      ?? originalTcm.categoryByTip?.get(tip.replace(/ /g, '_'));
    if (!cat) continue; // tip has no metadata, skip

    const tipColor = colorByTip.get(tip)
      ?? colorByTip.get(tip.replace(/_/g, ' '))
      ?? colorByTip.get(tip.replace(/ /g, '_'));
    const legendColor = legendColorForCat.get(cat);

    expect(tipColor, `I2: tip "${tip}" (cat "${cat}") has no color in colorByTip`).toBeDefined();
    expect(legendColor, `I3: category "${cat}" not in legend`).toBeDefined();
    expect(tipColor, `I2+I3: tip "${tip}" color (${tipColor}) != legend color for "${cat}" (${legendColor})`).toBe(legendColor);
  }
}

// ---------------------------------------------------------------------------
// Group 1: Basic cases (≤10 categories)
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — basic (≤10 categories)', () => {
  it('all tips visible → returns same object (early exit)', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['cat1', 'cat2', 'cat3']);
    const result = recolorForVisibleTips(tcm, ['A', 'B', 'C']);
    expect(result).toBe(tcm);
  });

  it('no visible tips → empty colorByTip and empty legend', () => {
    const tcm = makeMap(['A', 'B'], ['cat1', 'cat2']);
    const result = recolorForVisibleTips(tcm, []);
    expect(result.colorByTip.size).toBe(0);
    expect(result.legend).toHaveLength(0);
  });

  it('visible tips with no metadata → empty colorByTip and empty legend', () => {
    const tcm = makeMap(['A', 'B'], ['cat1', 'cat2']);
    const result = recolorForVisibleTips(tcm, ['X', 'Y']);
    expect(result.colorByTip.size).toBe(0);
    expect(result.legend).toHaveLength(0);
  });

  it('one category removed: legend has only remaining categories', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['alpha', 'beta', 'alpha', 'gamma']);
    // Remove 'beta' (tip B)
    const result = recolorForVisibleTips(tcm, ['A', 'C', 'D']);
    expect(result.legend.map(l => l.category).sort()).toEqual(['alpha', 'gamma']);
    assertConsistent(result, tcm, ['A', 'C', 'D']);
  });

  it('I1+I2+I3 hold when pruning to one category', () => {
    const tcm = makeMap(
      ['Dog', 'Wolf', 'Cat', 'Lion', 'Bear'],
      ['Canidae', 'Canidae', 'Felidae', 'Felidae', 'Ursidae']
    );
    const visible = ['Dog', 'Wolf'];
    const result = recolorForVisibleTips(tcm, visible);
    assertConsistent(result, tcm, visible);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('Canidae');
    // Should be reassigned to palette index 0
    expect(result.legend[0].color).toBe(PALETTE[0]);
  });

  it('recoloring reassigns from palette index 0', () => {
    // 5 categories: after filtering to last 2 they should get colors 0 and 1
    const tips = ['A', 'B', 'C', 'D', 'E'];
    const cats = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const tcm = makeMap(tips, cats);
    // Keep only delta and epsilon
    const result = recolorForVisibleTips(tcm, ['D', 'E']);
    expect(result.legend).toHaveLength(2);
    // Categories are sorted: delta=idx0, epsilon=idx1
    const catColors = new Map(result.legend.map(l => [l.category, l.color]));
    expect(catColors.get('delta')).toBe(PALETTE[0]);
    expect(catColors.get('epsilon')).toBe(PALETTE[1]);
    assertConsistent(result, tcm, ['D', 'E']);
  });

  it('preserves displayNameByTip in returned object', () => {
    const csv = 'id,cat,display\nA,cat1,Alpha\nB,cat2,Beta';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'id', 'cat', 'display');
    const result = recolorForVisibleTips(tcm, ['A']);
    expect(result.displayNameByTip?.get('A')).toBe('Alpha');
  });
});

// ---------------------------------------------------------------------------
// Group 2: Name variant matching (underscore ↔ space)
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — name variant matching', () => {
  it('tree uses underscores, metadata uses spaces', () => {
    const csv = 'tip,cat\nHomo sapiens,Primates\nPan troglodytes,Primates\nMus musculus,Rodentia';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Tree leaf names have underscores
    const visible = ['Homo_sapiens', 'Pan_troglodytes'];
    const result = recolorForVisibleTips(tcm, visible);
    assertConsistent(result, tcm, visible);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('Primates');
  });

  it('tree uses spaces, metadata uses underscores', () => {
    const csv = 'tip,cat\nHomo_sapiens,Primates\nMus_musculus,Rodentia';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    const visible = ['Homo sapiens'];
    const result = recolorForVisibleTips(tcm, visible);
    assertConsistent(result, tcm, visible);
    expect(result.legend).toHaveLength(1);
  });

  it('mixed: some tips exact-match, some via variant', () => {
    const csv = 'tip,cat\nA_B,cat1\nC D,cat2\nE,cat3';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Tree uses spaces for first, underscores for second, exact for third
    const visible = ['A B', 'C_D', 'E'];
    const result = recolorForVisibleTips(tcm, visible);
    assertConsistent(result, tcm, visible);
    expect(result.legend).toHaveLength(3);
  });

  it('variant tip visible, exact tip for same category also present: no duplicate legend entry', () => {
    const csv = 'tip,cat\nA B,cat1\nC,cat2';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Both "A_B" (variant) and "C" are visible
    const result = recolorForVisibleTips(tcm, ['A_B', 'C']);
    expect(result.legend).toHaveLength(2);
    assertConsistent(result, tcm, ['A_B', 'C']);
  });
});

// ---------------------------------------------------------------------------
// Group 3: >10 categories — the color-collision bug
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — >10 categories (palette wraps)', () => {
  /** Build a map with n categories, one tip per category named tip0..tipN-1. */
  function makeLargeMap(n: number) {
    const tips = Array.from({ length: n }, (_, i) => `tip${i}`);
    const cats = Array.from({ length: n }, (_, i) => `cat${String(i).padStart(2, '0')}`);
    return { tcm: makeMap(tips, cats), tips, cats };
  }

  it('I1: with 11 categories, filtering to last 1 shows only that category in legend', () => {
    const { tcm, tips } = makeLargeMap(11);
    // tip10 belongs to cat10, which wraps to PALETTE[0] (same as cat00)
    const visible = ['tip10'];
    const result = recolorForVisibleTips(tcm, visible);
    // I1: legend must have exactly 1 entry (cat10), NOT 2 (cat00 erroneously included)
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('cat10');
    assertConsistent(result, tcm, visible);
  });

  it('I1: with 12 categories, filtering to tips 10 and 11 shows only those 2 in legend', () => {
    const { tcm } = makeLargeMap(12);
    // cat10 shares color with cat00, cat11 shares color with cat01
    const visible = ['tip10', 'tip11'];
    const result = recolorForVisibleTips(tcm, visible);
    expect(result.legend).toHaveLength(2);
    const cats = result.legend.map(l => l.category).sort();
    expect(cats).toEqual(['cat10', 'cat11']);
    assertConsistent(result, tcm, visible);
  });

  it('I2+I3: with 11 cats, tip0 (cat00) and tip10 (cat10) both visible — correct colors', () => {
    const { tcm } = makeLargeMap(11);
    // Both cat00 and cat10 are visible; they originally shared PALETTE[0]
    const visible = ['tip0', 'tip10'];
    const result = recolorForVisibleTips(tcm, visible);
    assertConsistent(result, tcm, visible);
    // The two categories should get different colors
    const colors = result.legend.map(l => l.color);
    expect(new Set(colors).size).toBe(2);
  });

  it('I1+I2+I3: with 20 categories, filtering to middle categories only', () => {
    const { tcm, tips, cats } = makeLargeMap(20);
    // Keep categories 5-9 (one tip each)
    const visible = tips.slice(5, 10);
    const expectedCats = cats.slice(5, 10).sort();
    const result = recolorForVisibleTips(tcm, visible);
    expect(result.legend.map(l => l.category).sort()).toEqual(expectedCats);
    assertConsistent(result, tcm, visible);
  });

  it('I1: with exactly 10 cats → all visible → early exit (no wrapping issue)', () => {
    const { tcm, tips } = makeLargeMap(10);
    const result = recolorForVisibleTips(tcm, tips);
    expect(result).toBe(tcm); // early exit
  });

  it('I2+I3: all 11 cats visible → each tip gets correct category color', () => {
    const { tcm, tips } = makeLargeMap(11);
    const result = recolorForVisibleTips(tcm, tips);
    assertConsistent(result, tcm, tips);
  });

  it('I2+I3: 15 categories, remove first 5 → remaining 10 get correct unique colors', () => {
    const { tcm, tips, cats } = makeLargeMap(15);
    const visible = tips.slice(5);  // tip5..tip14
    const result = recolorForVisibleTips(tcm, visible);
    const expectedCats = cats.slice(5).sort();
    expect(result.legend.map(l => l.category).sort()).toEqual(expectedCats);
    assertConsistent(result, tcm, visible);
    // All 10 remaining categories should have unique colors
    const colors = result.legend.map(l => l.color);
    expect(new Set(colors).size).toBe(10);
  });

  it('I1: with 11 cats, filter to show cat00 tips only — cat10 (same old color) not in legend', () => {
    const { tcm } = makeLargeMap(11);
    const result = recolorForVisibleTips(tcm, ['tip0']);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('cat00');
    assertConsistent(result, tcm, ['tip0']);
  });
});

// ---------------------------------------------------------------------------
// Group 4: Mixed visible/invisible tips with multi-tip categories
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — multi-tip categories', () => {
  it('category with multiple tips: one pruned, one visible → category stays in legend', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['X', 'X', 'Y', 'Z']);
    // A is pruned, B is visible — category X should stay
    const result = recolorForVisibleTips(tcm, ['B', 'C', 'D']);
    expect(result.legend.map(l => l.category).sort()).toEqual(['X', 'Y', 'Z']);
    assertConsistent(result, tcm, ['B', 'C', 'D']);
  });

  it('category with multiple tips: all pruned → category removed from legend', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['X', 'X', 'Y', 'Z']);
    // Both A and B pruned → X should not appear
    const result = recolorForVisibleTips(tcm, ['C', 'D']);
    expect(result.legend.map(l => l.category).sort()).toEqual(['Y', 'Z']);
    assertConsistent(result, tcm, ['C', 'D']);
  });

  it('all categories pruned except one with a single tip → legend has exactly 1 entry', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['P', 'Q', 'R']);
    const result = recolorForVisibleTips(tcm, ['C']);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('R');
    assertConsistent(result, tcm, ['C']);
  });

  it('mix of metadata and non-metadata tips visible', () => {
    const tcm = makeMap(['A', 'B'], ['cat1', 'cat2']);
    // C and D are not in metadata
    const result = recolorForVisibleTips(tcm, ['A', 'C', 'D']);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('cat1');
    assertConsistent(result, tcm, ['A', 'C', 'D']);
  });
});

// ---------------------------------------------------------------------------
// Group 5: Idempotency and stability
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — idempotency and stability', () => {
  it('applying twice with same visible set produces same result', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D', 'E'], ['c1', 'c2', 'c3', 'c4', 'c5']);
    const visible = ['A', 'C', 'E'];
    const r1 = recolorForVisibleTips(tcm, visible);
    const r2 = recolorForVisibleTips(tcm, visible);
    expect(r1.legend).toEqual(r2.legend);
    expect([...r1.colorByTip.entries()].sort()).toEqual([...r2.colorByTip.entries()].sort());
  });

  it('legend order is stable (alphabetical by category)', () => {
    const tcm = makeMap(['Z', 'M', 'A'], ['Zebra', 'Middle', 'Alpha']);
    const result = recolorForVisibleTips(tcm, ['Z', 'M']);
    expect(result.legend.map(l => l.category)).toEqual(['Middle', 'Zebra']);
  });

  it('recoloring a subset then same subset again gives same colors', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['x', 'y', 'z']);
    const r1 = recolorForVisibleTips(tcm, ['B', 'C']);
    // r1 is a new tcm — recolor it again with same visible set
    const r2 = recolorForVisibleTips(tcm, ['B', 'C']);
    expect(r1.legend).toEqual(r2.legend);
  });

  it('does not mutate the original tcm', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['p', 'q', 'r']);
    const origLegend = [...tcm.legend];
    const origSize = tcm.colorByTip.size;
    recolorForVisibleTips(tcm, ['A']);
    expect(tcm.legend).toEqual(origLegend);
    expect(tcm.colorByTip.size).toBe(origSize);
  });
});

// ---------------------------------------------------------------------------
// Group 6: Edge cases with empty / single-entry inputs
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — edge cases', () => {
  it('empty original legend → always returns equivalent empty result', () => {
    // Empty tcm (no categories)
    const tcm = buildTipColorMap(parseCSV('tip,cat\nA,'), 'tip', 'cat');
    // A has empty category, so legend is empty
    const result = recolorForVisibleTips(tcm, ['A']);
    expect(result.legend).toHaveLength(0);
  });

  it('single category, single tip visible', () => {
    const tcm = makeMap(['A'], ['only']);
    const result = recolorForVisibleTips(tcm, ['A']);
    expect(result).toBe(tcm); // early exit: all visible
  });

  it('single category, zero visible → empty', () => {
    const tcm = makeMap(['A'], ['only']);
    const result = recolorForVisibleTips(tcm, []);
    expect(result.legend).toHaveLength(0);
  });

  it('all tips from same category pruned, other categories visible', () => {
    const tcm = makeMap(
      ['A1', 'A2', 'B', 'C'],
      ['alpha', 'alpha', 'beta', 'gamma']
    );
    const visible = ['B', 'C'];
    const result = recolorForVisibleTips(tcm, visible);
    expect(result.legend.map(l => l.category).sort()).toEqual(['beta', 'gamma']);
    assertConsistent(result, tcm, visible);
  });

  it('10th category (last palette slot) is visible alone', () => {
    const { tcm, tips } = makeLargeMap(10);
    // Only the 10th tip (cat09, last unique color) is visible
    const visible = [tips[9]];
    const result = recolorForVisibleTips(tcm, visible);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('cat09');
    assertConsistent(result, tcm, visible);
  });
});

function makeLargeMap(n: number) {
  const tips = Array.from({ length: n }, (_, i) => `tip${i}`);
  const cats = Array.from({ length: n }, (_, i) => `cat${String(i).padStart(2, '0')}`);
  return { tcm: makeMap(tips, cats), tips, cats };
}
