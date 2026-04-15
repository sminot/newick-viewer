import { TreeNode, LayoutNode, LayoutEdge, LayoutResult, LayoutType } from './types';
import { getLeafNames, getMaxBranchLength } from './newick-parser';

/** Compute rectangular (dendrogram) layout */
export function computeRectangularLayout(
  root: TreeNode,
  width: number,
  height: number,
  useBranchLengths: boolean = true
): LayoutResult {
  const leaves = getLeafNames(root);
  const leafCount = leaves.length;
  const maxBranchLen = useBranchLengths ? getMaxBranchLength(root) : getMaxDepthValue(root);

  const marginLeft = 10;
  const marginRight = 150;
  const marginTop = 20;
  const marginBottom = 20;

  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  const leafSpacing = leafCount > 1 ? plotHeight / (leafCount - 1) : plotHeight / 2;

  const nodes: LayoutNode[] = [];
  const nodeMap = new Map<TreeNode, LayoutNode>();
  const edges: LayoutEdge[] = [];
  let leafIndex = 0;

  function layout(
    node: TreeNode,
    parentX: number | null,
    parentY: number | null,
    depth: number
  ): { x: number; y: number } {
    const x = marginLeft + (maxBranchLen > 0
      ? (depth / maxBranchLen) * plotWidth
      : 0);

    let y: number;
    if (node.children.length === 0) {
      y = marginTop + leafIndex * leafSpacing;
      leafIndex++;
    } else {
      const childPositions = node.children.map((child) => {
        const childDepth = depth + (useBranchLengths ? (child.branchLength ?? 1) : 1);
        return layout(child, x, 0, childDepth);
      });
      y = (childPositions[0].y + childPositions[childPositions.length - 1].y) / 2;

      // Fix parentY for direct children via O(1) Map lookup
      for (const childNode of node.children) {
        const ln = nodeMap.get(childNode);
        if (ln) ln.parentY = y;
      }

      for (const cp of childPositions) {
        edges.push({
          sourceX: x,
          sourceY: y,
          targetX: cp.x,
          targetY: cp.y,
          elbowX: x,
          elbowY: cp.y,
        });
      }
    }

    const ln: LayoutNode = { node, x, y, parentX, parentY };
    nodes.push(ln);
    nodeMap.set(node, ln);
    return { x, y };
  }

  layout(root, null, null, 0);

  return { nodes, edges, width, height };
}

function getMaxDepthValue(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(getMaxDepthValue));
}

/** Compute radial (circular) layout */
export function computeRadialLayout(
  root: TreeNode,
  width: number,
  height: number,
  useBranchLengths: boolean = true
): LayoutResult {
  const leaves = getLeafNames(root);
  const leafCount = leaves.length;
  const maxBranchLen = useBranchLengths ? getMaxBranchLength(root) : getMaxDepthValue(root);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 100;

  const nodes: LayoutNode[] = [];
  const nodeMap = new Map<TreeNode, LayoutNode>();
  const edges: LayoutEdge[] = [];
  let leafIndex = 0;

  function layout(
    node: TreeNode,
    parentX: number | null,
    parentY: number | null,
    depth: number
  ): { angle: number; radius: number; x: number; y: number } {
    const radius = maxBranchLen > 0 ? (depth / maxBranchLen) * maxRadius : 0;

    let angle: number;
    if (node.children.length === 0) {
      angle = (leafIndex / leafCount) * 2 * Math.PI;
      leafIndex++;
    } else {
      const childResults = node.children.map((child) => {
        const childDepth = depth + (useBranchLengths ? (child.branchLength ?? 1) : 1);
        return layout(child, 0, 0, childDepth);
      });

      const minAngle = childResults[0].angle;
      const maxAngle = childResults[childResults.length - 1].angle;
      angle = (minAngle + maxAngle) / 2;

      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      // Fix parentX/parentY via O(1) Map lookup
      for (const childNode of node.children) {
        const ln = nodeMap.get(childNode);
        if (ln) { ln.parentX = x; ln.parentY = y; }
      }

      for (const cr of childResults) {
        edges.push({
          sourceX: x,
          sourceY: y,
          targetX: cr.x,
          targetY: cr.y,
        });
      }
    }

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    const ln: LayoutNode = { node, x, y, parentX, parentY };
    nodes.push(ln);
    nodeMap.set(node, ln);
    return { angle, radius, x, y };
  }

  layout(root, null, null, 0);

  return { nodes, edges, width, height };
}

/** Main layout dispatcher */
export function computeLayout(
  root: TreeNode,
  layoutType: LayoutType,
  width: number,
  height: number,
  useBranchLengths: boolean = true
): LayoutResult {
  switch (layoutType) {
    case 'rectangular':
      return computeRectangularLayout(root, width, height, useBranchLengths);
    case 'radial':
      return computeRadialLayout(root, width, height, useBranchLengths);
    default:
      return computeRectangularLayout(root, width, height, useBranchLengths);
  }
}
