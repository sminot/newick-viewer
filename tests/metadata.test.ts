import { describe, it, expect } from 'vitest';
import { parseCSV, buildTipColorMap } from '../src/metadata';

describe('parseCSV', () => {
  it('parses comma-separated CSV', () => {
    const csv = 'name,group\nHomo_sapiens,Primates\nMus_musculus,Rodentia';
    const table = parseCSV(csv);
    expect(table.headers).toEqual(['name', 'group']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].name).toBe('Homo_sapiens');
    expect(table.rows[0].group).toBe('Primates');
  });

  it('parses tab-separated TSV', () => {
    const tsv = 'name\tgroup\nA\tX\nB\tY';
    const table = parseCSV(tsv);
    expect(table.headers).toEqual(['name', 'group']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].name).toBe('A');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'name,description\nA,"has, comma"\nB,simple';
    const table = parseCSV(csv);
    expect(table.rows[0].description).toBe('has, comma');
  });

  it('handles quoted fields with escaped quotes', () => {
    const csv = 'name,note\nA,"said ""hello"""\nB,ok';
    const table = parseCSV(csv);
    expect(table.rows[0].note).toBe('said "hello"');
  });

  it('skips blank lines', () => {
    const csv = 'name,group\nA,X\n\nB,Y\n';
    const table = parseCSV(csv);
    expect(table.rows).toHaveLength(2);
  });

  it('handles Windows line endings', () => {
    const csv = 'name,group\r\nA,X\r\nB,Y';
    const table = parseCSV(csv);
    expect(table.rows).toHaveLength(2);
  });

  it('throws on header-only CSV', () => {
    expect(() => parseCSV('name,group')).toThrow('at least one data row');
  });
});

describe('buildTipColorMap', () => {
  it('assigns colors to categories', () => {
    const table = parseCSV('tip,category\nA,cat1\nB,cat2\nC,cat1');
    const map = buildTipColorMap(table, 'tip', 'category');

    expect(map.colorByTip.size).toBe(3);
    expect(map.legend).toHaveLength(2);
    // Same category should get same color
    expect(map.colorByTip.get('A')).toBe(map.colorByTip.get('C'));
    // Different categories should get different colors
    expect(map.colorByTip.get('A')).not.toBe(map.colorByTip.get('B'));
  });

  it('produces a sorted legend', () => {
    const table = parseCSV('tip,group\nA,Zebra\nB,Alpha\nC,Middle');
    const map = buildTipColorMap(table, 'tip', 'group');
    expect(map.legend.map((l) => l.category)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });

  it('handles missing category values', () => {
    const table = parseCSV('tip,group\nA,cat1\nB,\nC,cat1');
    const map = buildTipColorMap(table, 'tip', 'group');
    // B has no category, should not be in the map
    expect(map.colorByTip.has('B')).toBe(false);
    expect(map.colorByTip.size).toBe(2);
  });
});
