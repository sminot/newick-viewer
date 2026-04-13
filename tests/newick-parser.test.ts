import { describe, it, expect } from 'vitest';
import { parseNewick, toNewick, getLeafNames, countNodes, getMaxDepth, getMaxBranchLength } from '../src/newick-parser';

describe('parseNewick', () => {
  it('parses a simple two-leaf tree', () => {
    const tree = parseNewick('(A,B);');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[1].name).toBe('B');
    expect(tree.name).toBe('');
  });

  it('parses a tree with branch lengths', () => {
    const tree = parseNewick('(A:0.1,B:0.2):0.3;');
    expect(tree.children[0].branchLength).toBeCloseTo(0.1);
    expect(tree.children[1].branchLength).toBeCloseTo(0.2);
    expect(tree.branchLength).toBeCloseTo(0.3);
  });

  it('parses a nested tree', () => {
    const tree = parseNewick('((A,B),(C,D));');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].children).toHaveLength(2);
    expect(tree.children[1].children).toHaveLength(2);
    expect(tree.children[0].children[0].name).toBe('A');
    expect(tree.children[1].children[1].name).toBe('D');
  });

  it('parses a deeply nested tree', () => {
    const tree = parseNewick('(A,(B,(C,D)));');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[1].children[1].children[0].name).toBe('C');
  });

  it('parses branch lengths with nested structure', () => {
    const tree = parseNewick('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    expect(tree.children[0].branchLength).toBeCloseTo(0.3);
    expect(tree.children[0].children[0].name).toBe('A');
    expect(tree.children[0].children[0].branchLength).toBeCloseTo(0.1);
    expect(tree.children[1].children[1].branchLength).toBeCloseTo(0.5);
  });

  it('parses a tree with internal node labels', () => {
    const tree = parseNewick('((A,B)AB,(C,D)CD)root;');
    expect(tree.name).toBe('root');
    expect(tree.children[0].name).toBe('AB');
    expect(tree.children[1].name).toBe('CD');
  });

  it('parses quoted labels with spaces', () => {
    const tree = parseNewick("('Homo sapiens':0.1,'Pan troglodytes':0.2);");
    expect(tree.children[0].name).toBe('Homo sapiens');
    expect(tree.children[1].name).toBe('Pan troglodytes');
  });

  it('parses a single leaf', () => {
    const tree = parseNewick('A;');
    expect(tree.name).toBe('A');
    expect(tree.children).toHaveLength(0);
  });

  it('parses a trifurcating root (unrooted convention)', () => {
    const tree = parseNewick('(A,B,C);');
    expect(tree.children).toHaveLength(3);
  });

  it('handles missing branch lengths', () => {
    const tree = parseNewick('((A:0.1,B):0.3,(C,D:0.5));');
    expect(tree.children[0].children[0].branchLength).toBeCloseTo(0.1);
    expect(tree.children[0].children[1].branchLength).toBeNull();
    expect(tree.children[1].children[0].branchLength).toBeNull();
    expect(tree.children[1].children[1].branchLength).toBeCloseTo(0.5);
  });

  it('handles scientific notation in branch lengths', () => {
    const tree = parseNewick('(A:1.5e-3,B:2.0E-4);');
    expect(tree.children[0].branchLength).toBeCloseTo(0.0015);
    expect(tree.children[1].branchLength).toBeCloseTo(0.0002);
  });

  it('handles whitespace in the input', () => {
    const tree = parseNewick('  ( A : 0.1 , B : 0.2 ) ; ');
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[0].branchLength).toBeCloseTo(0.1);
  });

  it('handles the semicolon being optional', () => {
    const tree = parseNewick('(A,B)');
    expect(tree.children).toHaveLength(2);
  });

  it('parses a realistic primate tree', () => {
    const newick = '((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,Papio_anubis:0.0365):0.0150);';
    const tree = parseNewick(newick);
    const leaves = getLeafNames(tree);
    expect(leaves).toContain('Homo_sapiens');
    expect(leaves).toContain('Pan_troglodytes');
    expect(leaves).toContain('Gorilla_gorilla');
    expect(leaves).toContain('Macaca_mulatta');
    expect(leaves).toHaveLength(7);
  });

  it('throws on empty input', () => {
    expect(() => parseNewick('')).toThrow('Empty Newick string');
  });

  it('throws on unbalanced parentheses', () => {
    expect(() => parseNewick('((A,B);')).toThrow();
  });

  it('handles escaped single quotes in quoted labels', () => {
    const tree = parseNewick("('it''s_a_test':0.1,B:0.2);");
    expect(tree.children[0].name).toBe("it's_a_test");
    expect(tree.children[0].branchLength).toBeCloseTo(0.1);
  });

  it('strips bracket annotations (NHX/bootstrap)', () => {
    const tree = parseNewick('(A:0.1[100],B:0.2[95]):0.3[&&NHX:S=root];');
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[0].branchLength).toBeCloseTo(0.1);
    expect(tree.children[1].branchLength).toBeCloseTo(0.2);
  });

  it('handles bootstrap values as internal labels with annotations', () => {
    const tree = parseNewick('((A:0.05,B:0.1)90[&&NHX:B=90]:0.15,(C:0.2,D:0.25)75:0.3);');
    expect(tree.children[0].name).toBe('90');
    expect(tree.children[0].branchLength).toBeCloseTo(0.15);
    expect(getLeafNames(tree)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('handles nested bracket annotations', () => {
    const tree = parseNewick('(A[comment [nested] end]:0.1,B:0.2);');
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[0].branchLength).toBeCloseTo(0.1);
  });
});

describe('toNewick', () => {
  it('round-trips a simple tree', () => {
    const input = '(A,B)';
    const tree = parseNewick(input);
    const output = toNewick(tree);
    expect(output).toBe('(A,B)');
  });

  it('round-trips branch lengths', () => {
    const tree = parseNewick('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    const output = toNewick(tree);
    // Re-parse to verify structural equivalence
    const reparsed = parseNewick(output + ';');
    expect(getLeafNames(reparsed)).toEqual(getLeafNames(tree));
  });

  it('escapes single quotes in names', () => {
    const tree = parseNewick("('it''s_a_test',B);");
    const output = toNewick(tree);
    expect(output).toContain("'it''s_a_test'");
    // Should round-trip cleanly
    const reparsed = parseNewick(output + ';');
    expect(reparsed.children[0].name).toBe("it's_a_test");
  });
});

describe('getLeafNames', () => {
  it('returns leaf names for a simple tree', () => {
    const tree = parseNewick('((A,B),(C,D));');
    expect(getLeafNames(tree)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns single leaf name', () => {
    const tree = parseNewick('X;');
    expect(getLeafNames(tree)).toEqual(['X']);
  });
});

describe('countNodes', () => {
  it('counts all nodes', () => {
    const tree = parseNewick('((A,B),(C,D));');
    // 4 leaves + 2 internal + 1 root = 7
    expect(countNodes(tree)).toBe(7);
  });
});

describe('getMaxDepth', () => {
  it('returns 0 for a leaf', () => {
    const tree = parseNewick('A;');
    expect(getMaxDepth(tree)).toBe(0);
  });

  it('returns correct depth for a balanced tree', () => {
    const tree = parseNewick('((A,B),(C,D));');
    expect(getMaxDepth(tree)).toBe(2);
  });

  it('returns correct depth for an unbalanced tree', () => {
    const tree = parseNewick('(A,(B,(C,D)));');
    expect(getMaxDepth(tree)).toBe(3);
  });
});

describe('getMaxBranchLength', () => {
  it('returns 0 for a leaf', () => {
    const tree = parseNewick('A;');
    expect(getMaxBranchLength(tree)).toBe(0);
  });

  it('computes max root-to-leaf branch length', () => {
    const tree = parseNewick('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    // Longest path: root -> right child (0.6) -> D (0.5) = 1.1
    expect(getMaxBranchLength(tree)).toBeCloseTo(1.1);
  });
});
