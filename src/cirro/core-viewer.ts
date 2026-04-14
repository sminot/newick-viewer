/**
 * Core viewer logic extracted for use by the Cirro embedded tool.
 * This module bridges the existing D3-based renderer with external callers
 * that provide Newick data programmatically.
 */

import { parseTreeInput, getLeafNames, getMaxBranchLength, toNewick } from '../newick-parser';
import { computeLayout } from '../layout';
import { TreeRenderer } from '../renderer';
import { DEFAULT_STYLE, StyleOptions, LayoutType, TreeNode } from '../types';
import type { TipColorMap } from '../metadata';

export interface CoreViewerOptions {
  container: HTMLElement;
  newick: string;
  layout?: LayoutType;
  style?: Partial<StyleOptions>;
  tipColorMap?: TipColorMap | null;
}

/**
 * Render a tree into a container. Returns a cleanup function.
 */
export function renderNewickTree(options: CoreViewerOptions): { destroy: () => void } {
  const {
    container,
    newick,
    layout = 'rectangular',
    tipColorMap = null,
  } = options;

  const style: StyleOptions = { ...DEFAULT_STYLE, ...(options.style ?? {}) };

  const tree = parseTreeInput(newick);
  const rect = container.getBoundingClientRect();
  const w = rect.width || 900;
  const h = rect.height || 600;
  const leafCount = getLeafNames(tree).length;
  const treeHeight = Math.max(h, leafCount * (style.leafLabelSize + 8));

  const layoutResult = computeLayout(tree, layout, w, treeHeight);

  const renderer = new TreeRenderer({
    container,
    layout: layoutResult,
    style,
    layoutType: layout,
    root: tree,
    tipColorMap,
    onTreeEdit: (newRoot) => {
      // Re-render with mutated tree
      const newLayout = computeLayout(newRoot, layout, w, treeHeight);
      renderer.render(newLayout);
    },
  });

  if (treeHeight > h) {
    renderer.fitToView(layoutResult);
  }

  return {
    destroy: () => renderer.destroy(),
  };
}
