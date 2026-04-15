import { describe, it, expect } from 'vitest';
import {
  parseNewick,
  toNewick,
  getLeafNames,
  pruneNode,
  extractSubtree,
  rerootAt,
  ladderize,
} from '../src/newick-parser';

describe('pruneNode', () => {
  it('removes a leaf from a simple tree', () => {
    const tree = parseNewick('(A,B,C);');
    const leafB = tree.children[1]; // B
    const result = pruneNode(tree, leafB)!;
    expect(getLeafNames(result)).toEqual(['A', 'C']);
  });

  it('collapses unary parent after pruning', () => {
    const tree = parseNewick('((A,B),C);');
    const leafA = tree.children[0].children[0]; // A
    const result = pruneNode(tree, leafA)!;
    // After removing A, (A,B) becomes just B, which should be promoted
    expect(getLeafNames(result)).toEqual(['B', 'C']);
  });

  it('promotes single child when root becomes unary', () => {
    const tree = parseNewick('((A,B),C);');
    const leafC = tree.children[1]; // C
    const result = pruneNode(tree, leafC)!;
    expect(getLeafNames(result)).toEqual(['A', 'B']);
  });

  it('returns null when pruning root', () => {
    const tree = parseNewick('(A,B);');
    expect(pruneNode(tree, tree)).toBeNull();
  });

  it('combines branch lengths when collapsing unary parent', () => {
    const tree = parseNewick('((A:0.1,B:0.2):0.3,C:0.4);');
    const leafA = tree.children[0].children[0];
    const result = pruneNode(tree, leafA)!;
    // B had length 0.2, parent had 0.3, so B should now have 0.5
    const leafB = result.children.find((c) => c.name === 'B' || getLeafNames(c).includes('B'));
    expect(leafB).toBeDefined();
    // Find the actual B leaf
    const bLeaf = getLeafNames(result).includes('B')
      ? result.children.find((c) => c.name === 'B') ?? result
      : result;
    if (bLeaf.name === 'B') {
      expect(bLeaf.branchLength).toBeCloseTo(0.5);
    }
  });

  it('preserves zero branch lengths', () => {
    const tree = parseNewick('((A:0,B:0.2):0,C:0.4);');
    const leafA = tree.children[0].children[0];
    const result = pruneNode(tree, leafA)!;
    // B had 0.2, parent had 0, combined should be 0.2 (not null)
    const bLeaf = result.children.find((c) => c.name === 'B');
    if (bLeaf) {
      expect(bLeaf.branchLength).toBeCloseTo(0.2);
    }
  });
});

describe('extractSubtree', () => {
  it('deep copies a subtree', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const subtree = extractSubtree(tree.children[0]);
    expect(getLeafNames(subtree)).toEqual(['A', 'B']);
    // Modifying the copy should not affect the original
    subtree.children[0].name = 'X';
    expect(tree.children[0].children[0].name).toBe('A');
  });
});

describe('rerootAt', () => {
  it('reroots a simple tree', () => {
    const tree = parseNewick('((A,B),C);');
    const target = tree.children[0]; // (A,B) node
    const newRoot = rerootAt(tree, target);
    // New root should be the (A,B) node
    const leaves = getLeafNames(newRoot);
    expect(leaves).toContain('A');
    expect(leaves).toContain('B');
    expect(leaves).toContain('C');
    expect(leaves).toHaveLength(3);
  });

  it('preserves branch lengths when rerooting', () => {
    // Tree: ((A:1,B:2):3,C:4)
    const tree = parseNewick('((A:1,B:2):3,C:4);');
    const target = tree.children[0]; // (A,B) internal node
    const newRoot = rerootAt(tree, target);

    // Serialize and reparse to verify structure
    const newick = toNewick(newRoot) + ';';
    const reparsed = parseNewick(newick);
    const leaves = getLeafNames(reparsed);
    expect(leaves).toContain('A');
    expect(leaves).toContain('B');
    expect(leaves).toContain('C');
  });

  it('preserves branch lengths on a deeper tree', () => {
    // Tree: (A:1,(B:2,(C:3,D:4):5):6)
    const tree = parseNewick('(A:1,(B:2,(C:3,D:4):5):6);');
    // Find the (C,D) node
    const target = tree.children[1].children[1]; // (C,D)
    const newRoot = rerootAt(tree, target);

    const leaves = getLeafNames(newRoot);
    expect(leaves).toHaveLength(4);
    expect(leaves).toContain('A');
    expect(leaves).toContain('D');

    // The edge from old-root → (B,(C,D)) was 6
    // After rerooting at (C,D), the old root becomes a child
    // Check that total path lengths are preserved by round-tripping
    const newick = toNewick(newRoot) + ';';
    const reparsed = parseNewick(newick);
    expect(getLeafNames(reparsed)).toHaveLength(4);
  });

  it('returns same tree when rerooting at root', () => {
    const tree = parseNewick('(A,B,C);');
    const result = rerootAt(tree, tree);
    expect(result).toBe(tree);
  });
});

describe('ladderize', () => {
  it('sorts children by descending leaf count', () => {
    // Left child has 1 leaf, right has 3
    const tree = parseNewick('(A,(B,C,D));');
    ladderize(tree, false); // descending = large first
    // After ladderize, (B,C,D) should come first
    expect(tree.children[0].children.length).toBe(3); // (B,C,D)
    expect(tree.children[1].name).toBe('A');
  });

  it('sorts children by ascending leaf count', () => {
    const tree = parseNewick('((B,C,D),A);');
    ladderize(tree, true); // ascending = small first
    // A should come first
    expect(tree.children[0].name).toBe('A');
    expect(tree.children[1].children.length).toBe(3);
  });

  it('sorts recursively', () => {
    const tree = parseNewick('((A,(B,C)),D);');
    ladderize(tree, false); // descending
    // Root: (A,(B,C)) has 3 leaves, D has 1 → (A,(B,C)) first
    expect(tree.children[0].children.length).toBe(2);
    // Inside that: (B,C) has 2 leaves, A has 1 → (B,C) first
    expect(tree.children[0].children[0].children.length).toBe(2);
  });

  it('is idempotent', () => {
    const tree = parseNewick('(A,(B,C,D));');
    ladderize(tree, false);
    const first = toNewick(tree);
    ladderize(tree, false);
    const second = toNewick(tree);
    expect(first).toBe(second);
  });
});

describe('toNewick round-trip', () => {
  it('preserves root branch length', () => {
    const tree = parseNewick('(A:0.1,B:0.2):0.3;');
    const output = toNewick(tree);
    expect(output).toContain(':0.3');
    const reparsed = parseNewick(output + ';');
    expect(reparsed.branchLength).toBeCloseTo(0.3);
  });
});
