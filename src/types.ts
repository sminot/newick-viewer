/** A node in a phylogenetic tree */
export interface TreeNode {
  name: string;
  branchLength: number | null;
  children: TreeNode[];
  /** Computed during layout */
  x?: number;
  y?: number;
  /** For internal tracking */
  id?: number;
}

export type LayoutType = 'rectangular' | 'radial';

export interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  /** Parent coordinates for drawing branches */
  parentX: number | null;
  parentY: number | null;
}

export interface LayoutEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** For rectangular layout, the elbow Y coordinate */
  elbowX?: number;
  elbowY?: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export interface StyleOptions {
  branchColor: string;
  branchWidth: number;
  leafLabelSize: number;
  internalLabelSize: number;
  showBranchLengths: boolean;
  showInternalLabels: boolean;
  leafLabelColor: string;
  fontFamily: string;
}

export interface ViewState {
  newick1: string;
  newick2: string;
  layout: LayoutType;
  style: StyleOptions;
  tanglegram: boolean;
}

export const DEFAULT_STYLE: StyleOptions = {
  branchColor: '#1b1b1b',
  branchWidth: 1.5,
  leafLabelSize: 13,
  internalLabelSize: 11,
  showBranchLengths: false,
  showInternalLabels: false,
  leafLabelColor: '#1b1b1b',
  fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};
