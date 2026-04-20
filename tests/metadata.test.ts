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

  it('handles old Mac line endings (\\r only)', () => {
    const csv = 'name\tgroup\rA\tX\rB\tY';
    const table = parseCSV(csv);
    expect(table.headers).toEqual(['name', 'group']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0].name).toBe('A');
  });

  it('strips UTF-8 BOM from start of file', () => {
    const csv = '\uFEFFname,group\nA,X\nB,Y';
    const table = parseCSV(csv);
    expect(table.headers[0]).toBe('name');
    expect(table.rows[0].name).toBe('A');
  });

  it('strips leading empty column (R-style row names in header)', () => {
    // R write.table() with col.names=TRUE, row.names=TRUE produces a leading
    // empty field in the header row
    const tsv = '\tname\tgroup\nrow1\tA\tX\nrow2\tB\tY';
    const table = parseCSV(tsv);
    expect(table.headers).toEqual(['name', 'group']);
    expect(table.rows[0].name).toBe('A');
    expect(table.rows[0].group).toBe('X');
  });

  it('strips leading numeric row index from data rows when header has no leading empty', () => {
    const tsv = 'name\tgroup\n1\tA\tX\n2\tB\tY';
    const table = parseCSV(tsv);
    expect(table.headers).toEqual(['name', 'group']);
    expect(table.rows[0].name).toBe('A');
    expect(table.rows[0].group).toBe('X');
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
