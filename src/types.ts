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

export type ConnectionColorMode = 'single' | 'multi';
export type ConnectionLineStyle = 'solid' | 'dashed' | 'dotted';

export interface TanglegramStyle {
  spacing: number;            // 0-1, fraction of total width used as gap between trees
  connectionColor: string;    // color when mode is 'single'
  connectionColorMode: ConnectionColorMode;
  connectionWidth: number;
  connectionLineStyle: ConnectionLineStyle;
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
  /** Canvas width override (0 = auto from viewer size) */
  canvasWidth: number;
  /** Canvas height override (0 = auto from leaf count) */
  canvasHeight: number;
}

export interface ViewState {
  newick1: string;
  newick2: string;
  layout: LayoutType;
  style: StyleOptions;
  tanglegram: boolean;
  tanglegramStyle: TanglegramStyle;
  metadata?: string;
  metadataIdCol?: string;
  metadataCatCol?: string;
}

export const DEFAULT_TANGLEGRAM_STYLE: TanglegramStyle = {
  spacing: 0.24,
  connectionColor: '#71767a',
  connectionColorMode: 'single',
  connectionWidth: 1,
  connectionLineStyle: 'solid',
};

export const DEFAULT_STYLE: StyleOptions = {
  branchColor: '#1b1b1b',
  branchWidth: 1.5,
  leafLabelSize: 13,
  internalLabelSize: 11,
  showBranchLengths: false,
  showInternalLabels: false,
  leafLabelColor: '#1b1b1b',
  fontFamily: "'Source Sans Pro', 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  canvasWidth: 0,
  canvasHeight: 0,
};
