/**
 * Red-team round 2: deeper edge cases for recolorForVisibleTips and buildTipColorMap.
 *
 * Focus areas:
 *   - Duplicate/overwritten tip entries in metadata
 *   - Variant name interactions during the "all visible" early exit
 *   - Tanglegram-like combined tip lists (union of two trees)
 *   - Legend ordering stability
 *   - categoryByTip persistence through recolor operations
 *   - Recoloring when all visible tips match only via variant names
 */

import { describe, it, expect } from 'vitest';
import { buildTipColorMap, recolorForVisibleTips } from '../src/metadata';
import { parseCSV } from '../src/metadata';

const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

function makeMap(tips: string[], categories: string[]) {
  const csv = ['tip,cat', ...tips.map((t, i) => `${t},${categories[i]}`)].join('\n');
  return buildTipColorMap(parseCSV(csv), 'tip', 'cat');
}

// ---------------------------------------------------------------------------
// Group A: duplicate tip rows in metadata
// ---------------------------------------------------------------------------
describe('buildTipColorMap — duplicate tip rows', () => {
  it('last row wins when same tip appears twice with different categories', () => {
    const csv = 'tip,cat\nA,cat1\nA,cat2\nB,cat1';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Row 2 overwrites row 1 for tip A: A belongs to cat2, B belongs to cat1
    expect(tcm.categoryByTip.get('A')).toBe('cat2');
    expect(tcm.categoryByTip.get('B')).toBe('cat1');
    // A has cat2's color, B has cat1's color — they differ
    expect(tcm.colorByTip.get('A')).not.toBe(tcm.colorByTip.get('B'));
    // colorByTip and categoryByTip agree for A
    const catA = tcm.categoryByTip.get('A')!;
    const legendA = tcm.legend.find(l => l.category === catA);
    expect(tcm.colorByTip.get('A')).toBe(legendA?.color);
  });

  it('colorByTip and categoryByTip are consistent for duplicate tips', () => {
    const csv = 'tip,cat\nA,alpha\nA,beta';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    const cat = tcm.categoryByTip.get('A')!;
    const color = tcm.colorByTip.get('A')!;
    const legendEntry = tcm.legend.find(l => l.category === cat);
    expect(legendEntry).toBeDefined();
    expect(legendEntry!.color).toBe(color);
  });
});

// ---------------------------------------------------------------------------
// Group B: "all visible" early exit with variant names
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — early exit with variant names', () => {
  it('early exit triggers when all tips visible via variant names', () => {
    const csv = 'tip,cat\nHomo sapiens,Primates\nMus musculus,Rodentia';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Both tips are "visible" but tree uses underscores
    const result = recolorForVisibleTips(tcm, ['Homo_sapiens', 'Mus_musculus']);
    // All categories visible → early exit
    expect(result).toBe(tcm);
  });

  it('early exit triggers correctly when tips are exact-match', () => {
    const tcm = makeMap(['A', 'B'], ['x', 'y']);
    const result = recolorForVisibleTips(tcm, ['A', 'B']);
    expect(result).toBe(tcm);
  });

  it('no early exit when one tip is visible only via variant and its category is the only visible one', () => {
    const csv = 'tip,cat\nHomo sapiens,Primates\nMus musculus,Rodentia';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Only Mus is visible (via underscore variant), so Primates should be dropped
    const result = recolorForVisibleTips(tcm, ['Mus_musculus']);
    expect(result).not.toBe(tcm);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('Rodentia');
  });
});

// ---------------------------------------------------------------------------
// Group C: tanglegram-like scenarios (union of two tip sets)
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — tanglegram union of two trees', () => {
  it('left and right trees have disjoint categories → legend shows all', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['cat1', 'cat1', 'cat2', 'cat2']);
    // Left tree has A,B (cat1); right tree has C,D (cat2)
    const allVisible = ['A', 'B', 'C', 'D'];
    const result = recolorForVisibleTips(tcm, allVisible);
    expect(result).toBe(tcm); // early exit: all categories visible
  });

  it('left tree pruned: union still includes pruned categories from right', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['cat1', 'cat2', 'cat3', 'cat4']);
    // Left tree pruned to A (cat1); right tree has all
    const leftVisible = ['A'];
    const rightVisible = ['A', 'B', 'C', 'D'];
    const combined = [...new Set([...leftVisible, ...rightVisible])];
    const result = recolorForVisibleTips(tcm, combined);
    // All 4 categories present in combined → early exit
    expect(result).toBe(tcm);
  });

  it('both trees pruned: union has only surviving categories', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D'], ['cat1', 'cat2', 'cat3', 'cat4']);
    // Both trees pruned to only A and C
    const combined = ['A', 'C'];
    const result = recolorForVisibleTips(tcm, combined);
    expect(result.legend).toHaveLength(2);
    expect(result.legend.map(l => l.category).sort()).toEqual(['cat1', 'cat3']);
  });

  it('union of tips from 11+ category trees: only truly visible cats in legend', () => {
    // 11 categories, two trees each show half
    const tips = Array.from({ length: 11 }, (_, i) => `tip${i}`);
    const cats = Array.from({ length: 11 }, (_, i) => `cat${String(i).padStart(2, '0')}`);
    const csv = ['tip,cat', ...tips.map((t, i) => `${t},${cats[i]}`)].join('\n');
    const tcm = buildTipColorMap(parseCSV(csv), 'tip', 'cat');

    // Left tree: tips 0-5, right tree: tips 3-10 (overlap on 3,4,5)
    const combined = [...new Set([...tips.slice(0, 6), ...tips.slice(3, 11)])];
    const result = recolorForVisibleTips(tcm, combined);

    // All 11 categories are covered (0-5 from left, 3-10 from right)
    expect(result.legend).toHaveLength(11);
  });
});

// ---------------------------------------------------------------------------
// Group D: categoryByTip persists correctly through recolor
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — categoryByTip persistence', () => {
  it('recolored result has original categoryByTip', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['p', 'q', 'r']);
    const result = recolorForVisibleTips(tcm, ['A', 'B']);
    // categoryByTip should be the same map (passed through from original)
    expect(result.categoryByTip).toBe(tcm.categoryByTip);
  });

  it('empty result has empty categoryByTip', () => {
    const tcm = makeMap(['A', 'B'], ['p', 'q']);
    const result = recolorForVisibleTips(tcm, []);
    expect(result.categoryByTip.size).toBe(0);
  });

  it('all-visible early exit: categoryByTip is original', () => {
    const tcm = makeMap(['A', 'B'], ['p', 'q']);
    const result = recolorForVisibleTips(tcm, ['A', 'B']);
    expect(result.categoryByTip).toBe(tcm.categoryByTip);
  });
});

// ---------------------------------------------------------------------------
// Group E: legend ordering stability
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — legend ordering', () => {
  it('legend is always in the same alphabetical order as original', () => {
    const tcm = makeMap(['X', 'Y', 'Z'], ['zebra', 'alpha', 'middle']);
    // Filter to zebra and middle (skipping alpha)
    const result = recolorForVisibleTips(tcm, ['X', 'Z']);
    // Original legend is [alpha, middle, zebra]; filtered = [middle, zebra]
    expect(result.legend.map(l => l.category)).toEqual(['middle', 'zebra']);
  });

  it('recolored legend colors start at PALETTE[0]', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['cat_a', 'cat_b', 'cat_c']);
    // Remove cat_a (alphabetically first)
    const result = recolorForVisibleTips(tcm, ['B', 'C']);
    // cat_b and cat_c now get PALETTE[0] and PALETTE[1]
    expect(result.legend[0].color).toBe(PALETTE[0]);
    expect(result.legend[1].color).toBe(PALETTE[1]);
  });

  it('>10 cats: recolored legend uses correct palette indices after wrapping', () => {
    const n = 11;
    const tips = Array.from({ length: n }, (_, i) => `tip${i}`);
    const cats = Array.from({ length: n }, (_, i) => `cat${String(i).padStart(2, '0')}`);
    const csv = ['tip,cat', ...tips.map((t, i) => `${t},${cats[i]}`)].join('\n');
    const tcm = buildTipColorMap(parseCSV(csv), 'tip', 'cat');

    // Keep only cat05..cat10 (6 categories)
    const visible = tips.slice(5, 11);
    const result = recolorForVisibleTips(tcm, visible);
    // Should have exactly 6 entries
    expect(result.legend).toHaveLength(6);
    // First entry gets PALETTE[0], second PALETTE[1], etc.
    result.legend.forEach((entry, i) => {
      expect(entry.color).toBe(PALETTE[i]);
    });
  });
});

// ---------------------------------------------------------------------------
// Group F: colorByTip and legend agree for ALL visible tips simultaneously
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — full consistency for varied scenarios', () => {
  function assertFullConsistency(
    tcm: ReturnType<typeof buildTipColorMap>,
    visible: string[]
  ) {
    const result = recolorForVisibleTips(tcm, visible);
    const legendMap = new Map(result.legend.map(l => [l.category, l.color]));

    for (const tip of visible) {
      const cat = tcm.categoryByTip.get(tip)
        ?? tcm.categoryByTip.get(tip.replace(/_/g, ' '))
        ?? tcm.categoryByTip.get(tip.replace(/ /g, '_'));
      if (!cat) continue;

      const tipColor = result.colorByTip.get(tip)
        ?? result.colorByTip.get(tip.replace(/_/g, ' '))
        ?? result.colorByTip.get(tip.replace(/ /g, '_'));
      const legendColor = legendMap.get(cat);

      expect(tipColor).toBe(legendColor);
    }
  }

  it('3 cats, remove first: cat colors match legend', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['aa', 'bb', 'cc']);
    assertFullConsistency(tcm, ['B', 'C']);
  });

  it('5 cats, remove middle one: cats colors match legend', () => {
    const tcm = makeMap(['A', 'B', 'C', 'D', 'E'], ['c1', 'c2', 'c3', 'c4', 'c5']);
    assertFullConsistency(tcm, ['A', 'B', 'D', 'E']);
  });

  it('10 cats (palette boundary), remove last: colors match legend', () => {
    const tips = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const cats = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const tcm = makeMap(tips, cats);
    assertFullConsistency(tcm, tips.slice(0, 9));
  });

  it('11 cats (wraps), remove cat at index 0 (same color as cat10): colors match', () => {
    const tips = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const cats = Array.from({ length: 11 }, (_, i) => `cat${String(i).padStart(2, '0')}`);
    const csv = ['tip,cat', ...tips.map((t, i) => `${t},${cats[i]}`)].join('\n');
    const tcm = buildTipColorMap(parseCSV(csv), 'tip', 'cat');
    // Remove cat00 (t0), keep cat01..cat10 including cat10 which used to share color with cat00
    assertFullConsistency(tcm, tips.slice(1));
  });

  it('11 cats, filter to exactly 1 tip: consistency holds', () => {
    const tips = Array.from({ length: 11 }, (_, i) => `t${i}`);
    const cats = Array.from({ length: 11 }, (_, i) => `cat${i}`);
    const csv = ['tip,cat', ...tips.map((t, i) => `${t},${cats[i]}`)].join('\n');
    const tcm = buildTipColorMap(parseCSV(csv), 'tip', 'cat');
    assertFullConsistency(tcm, ['t5']);
  });

  it('variant names: consistency holds end-to-end', () => {
    const csv = 'tip,cat\nHomo sapiens,Primates\nPan troglodytes,Primates\nMus musculus,Rodentia\nRattus norvegicus,Rodentia';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // Tree uses underscores, keep only Rodentia
    assertFullConsistency(tcm, ['Mus_musculus', 'Rattus_norvegicus']);
  });
});

// ---------------------------------------------------------------------------
// Group G: duplicate visible tip names (tree might list same leaf twice — degenerate)
// ---------------------------------------------------------------------------
describe('recolorForVisibleTips — duplicate visible tip names', () => {
  it('duplicate names in visible set treated same as unique', () => {
    const tcm = makeMap(['A', 'B', 'C'], ['x', 'y', 'z']);
    const r1 = recolorForVisibleTips(tcm, ['A', 'B']);
    const r2 = recolorForVisibleTips(tcm, ['A', 'A', 'B', 'B']);
    expect(r1.legend).toEqual(r2.legend);
    expect([...r1.colorByTip.entries()].sort()).toEqual([...r2.colorByTip.entries()].sort());
  });
});

// ---------------------------------------------------------------------------
// Group H: metadata with empty category values
// ---------------------------------------------------------------------------
describe('buildTipColorMap — empty category values', () => {
  it('tip with empty category is excluded from colorByTip and categoryByTip', () => {
    const csv = 'tip,cat\nA,\nB,cat1';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    expect(tcm.colorByTip.has('A')).toBe(false);
    expect(tcm.categoryByTip.has('A')).toBe(false);
    expect(tcm.colorByTip.has('B')).toBe(true);
    expect(tcm.categoryByTip.has('B')).toBe(true);
  });

  it('recolorForVisibleTips: visible tip with empty category excluded from legend', () => {
    const csv = 'tip,cat\nA,\nB,cat1\nC,cat2';
    const table = parseCSV(csv);
    const tcm = buildTipColorMap(table, 'tip', 'cat');
    // A has no category, so filtering to [A, B] keeps cat1 but not A's nonexistent cat
    const result = recolorForVisibleTips(tcm, ['A', 'B']);
    expect(result.legend).toHaveLength(1);
    expect(result.legend[0].category).toBe('cat1');
  });
});
