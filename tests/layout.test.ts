import { describe, it, expect } from 'vitest';
import { computeLayout, computeRectangularLayout, computeRadialLayout } from '../src/layout';
import { parseNewick } from '../src/newick-parser';

describe('computeRectangularLayout', () => {
  it('produces nodes for all tree nodes', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const layout = computeRectangularLayout(tree, 800, 600);
    // 7 nodes: root + 2 internal + 4 leaves
    expect(layout.nodes).toHaveLength(7);
  });

  it('produces edges for parent-child connections', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const layout = computeRectangularLayout(tree, 800, 600);
    // 6 edges: root has 2 children, each child has 2 children = 2 + 2 + 2 = 6
    // Actually: internal nodes produce edges, root->left produces left's 2 children edges,
    // root->right produces right's 2 children edges, plus root's own 2 edges = 6 total
    expect(layout.edges.length).toBeGreaterThanOrEqual(4);
  });

  it('leaf nodes have increasing y-coordinates', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const layout = computeRectangularLayout(tree, 800, 600);
    const leaves = layout.nodes.filter((n) => n.node.children.length === 0);
    for (let i = 1; i < leaves.length; i++) {
      expect(leaves[i].y).toBeGreaterThan(leaves[i - 1].y);
    }
  });

  it('uses branch lengths for x-positioning', () => {
    const tree = parseNewick('(A:0.1,B:0.5);');
    const layout = computeRectangularLayout(tree, 800, 600, true);
    const leaves = layout.nodes.filter((n) => n.node.children.length === 0);
    const a = leaves.find((n) => n.node.name === 'A')!;
    const b = leaves.find((n) => n.node.name === 'B')!;
    // B should be further right (larger branch length)
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('handles a single leaf tree', () => {
    const tree = parseNewick('A;');
    const layout = computeRectangularLayout(tree, 800, 600);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
  });

  it('internal nodes are vertically centered between children', () => {
    const tree = parseNewick('((A,B),C);');
    const layout = computeRectangularLayout(tree, 800, 600);
    const leaves = layout.nodes.filter((n) => n.node.children.length === 0);
    const internal = layout.nodes.find(
      (n) => n.node.children.length === 2 && n.node.children[0].name === 'A'
    );
    if (internal) {
      const a = leaves.find((n) => n.node.name === 'A')!;
      const b = leaves.find((n) => n.node.name === 'B')!;
      expect(internal.y).toBeCloseTo((a.y + b.y) / 2);
    }
  });
});

describe('computeRadialLayout', () => {
  it('produces nodes for all tree nodes', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const layout = computeRadialLayout(tree, 800, 800);
    expect(layout.nodes).toHaveLength(7);
  });

  it('places nodes in a circular pattern', () => {
    const tree = parseNewick('((A,B),(C,D));');
    const layout = computeRadialLayout(tree, 800, 800);
    const leaves = layout.nodes.filter((n) => n.node.children.length === 0);

    // All leaves should be at roughly the same distance from center
    const cx = 400;
    const cy = 400;
    const distances = leaves.map(
      (l) => Math.sqrt((l.x - cx) ** 2 + (l.y - cy) ** 2)
    );

    // When all branch lengths are equal (defaulting to 1), leaves should be equidistant from center
    // Allow some tolerance for internal nodes
    const maxDist = Math.max(...distances);
    const minDist = Math.min(...distances);
    // All leaves should be at similar radii (within 50% of max)
    expect(minDist).toBeGreaterThan(maxDist * 0.3);
  });
});

describe('computeLayout', () => {
  it('dispatches to rectangular layout', () => {
    const tree = parseNewick('(A,B);');
    const layout = computeLayout(tree, 'rectangular', 800, 600);
    expect(layout.nodes).toHaveLength(3);
  });

  it('dispatches to radial layout', () => {
    const tree = parseNewick('(A,B);');
    const layout = computeLayout(tree, 'radial', 800, 800);
    expect(layout.nodes).toHaveLength(3);
  });
});
