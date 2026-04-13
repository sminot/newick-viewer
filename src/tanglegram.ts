import * as d3 from 'd3';
import { TreeNode, LayoutResult, StyleOptions } from './types';
import { computeLayout } from './layout';

export interface TanglegramOptions {
  container: HTMLElement;
  tree1: TreeNode;
  tree2: TreeNode;
  style: StyleOptions;
}

/**
 * Render a tanglegram: two trees facing each other with
 * connecting lines between matching leaf labels.
 */
export class TanglegramRenderer {
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private container: HTMLElement;

  constructor(private options: TanglegramOptions) {
    this.container = options.container;
    this.init();
    this.render();
  }

  private init(): void {
    d3.select(this.container).selectAll('*').remove();

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('class', 'tanglegram-svg');

    this.g = this.svg.append('g').attr('class', 'tanglegram-group');

    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
  }

  render(): void {
    this.g.selectAll('*').remove();

    const { tree1, tree2, style } = this.options;
    const containerRect = this.container.getBoundingClientRect();
    const totalWidth = containerRect.width || 1200;
    const totalHeight = containerRect.height || 800;

    // Each tree gets ~40% of width, middle 20% for connecting lines
    const treeWidth = totalWidth * 0.38;
    const gapWidth = totalWidth * 0.24;
    const treeHeight = totalHeight;

    // Layout left tree (normal)
    const layout1 = computeLayout(tree1, 'rectangular', treeWidth, treeHeight);

    // Layout right tree (mirrored)
    const layout2 = computeLayout(tree2, 'rectangular', treeWidth, treeHeight);

    // Mirror the right tree: flip X coordinates
    const rightOffset = treeWidth + gapWidth;
    for (const node of layout2.nodes) {
      node.x = rightOffset + (treeWidth - node.x);
    }
    for (const edge of layout2.edges) {
      edge.sourceX = rightOffset + (treeWidth - edge.sourceX);
      edge.targetX = rightOffset + (treeWidth - edge.targetX);
      if (edge.elbowX !== undefined) {
        edge.elbowX = rightOffset + (treeWidth - edge.elbowX);
      }
    }

    // Draw left tree
    this.drawTree(layout1, style, 'left');

    // Draw right tree (with right-aligned labels)
    this.drawTree(layout2, style, 'right');

    // Draw connecting lines between matching leaves
    this.drawConnections(layout1, layout2, style);
  }

  private drawTree(
    layout: LayoutResult,
    style: StyleOptions,
    side: 'left' | 'right'
  ): void {
    const group = this.g.append('g').attr('class', `tree-${side}`);

    // Edges with elbow connectors
    group.selectAll('path.branch')
      .data(layout.edges)
      .enter()
      .append('path')
      .attr('class', 'branch')
      .attr('d', (d) => {
        if (d.elbowX !== undefined && d.elbowY !== undefined) {
          if (side === 'right') {
            // Mirrored elbow
            return `M${d.sourceX},${d.sourceY} V${d.elbowY} H${d.targetX}`;
          }
          return `M${d.sourceX},${d.sourceY} V${d.elbowY} H${d.targetX}`;
        }
        return `M${d.sourceX},${d.sourceY} L${d.targetX},${d.targetY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', style.branchColor)
      .attr('stroke-width', style.branchWidth);

    // Leaf labels
    const leafNodes = layout.nodes.filter((n) => n.node.children.length === 0);
    group.selectAll('text.leaf-label')
      .data(leafNodes)
      .enter()
      .append('text')
      .attr('class', 'leaf-label')
      .attr('x', (d) => d.x + (side === 'left' ? 6 : -6))
      .attr('y', (d) => d.y)
      .attr('dy', '0.35em')
      .attr('text-anchor', side === 'left' ? 'start' : 'end')
      .attr('font-size', style.leafLabelSize + 'px')
      .attr('font-family', style.fontFamily)
      .attr('fill', style.leafLabelColor)
      .attr('font-style', 'italic')
      .text((d) => d.node.name.replace(/_/g, ' '));

    // Leaf dots
    group.selectAll('circle.leaf-node')
      .data(leafNodes)
      .enter()
      .append('circle')
      .attr('class', 'leaf-node')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 2)
      .attr('fill', style.branchColor);
  }

  private drawConnections(
    layout1: LayoutResult,
    layout2: LayoutResult,
    style: StyleOptions
  ): void {
    const connGroup = this.g.append('g').attr('class', 'connections');

    const leaves1 = layout1.nodes.filter((n) => n.node.children.length === 0);
    const leaves2 = layout2.nodes.filter((n) => n.node.children.length === 0);

    // Map leaf names to positions for right tree
    const leaf2Map = new Map<string, { x: number; y: number }>();
    for (const leaf of leaves2) {
      leaf2Map.set(leaf.node.name, { x: leaf.x, y: leaf.y });
    }

    // Generate distinguishable colors for connections
    const matchingLeaves = leaves1.filter((l) => leaf2Map.has(l.node.name));
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Draw curved connecting lines
    matchingLeaves.forEach((leaf1, i) => {
      const pos2 = leaf2Map.get(leaf1.node.name);
      if (!pos2) return;

      const midX = (leaf1.x + pos2.x) / 2;

      connGroup.append('path')
        .attr('class', 'connection')
        .attr('d', `M${leaf1.x},${leaf1.y} C${midX},${leaf1.y} ${midX},${pos2.y} ${pos2.x},${pos2.y}`)
        .attr('fill', 'none')
        .attr('stroke', colorScale(String(i)))
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.5);
    });
  }

  fitToView(): void {
    const containerRect = this.container.getBoundingClientRect();
    const cw = containerRect.width;
    const ch = containerRect.height;
    const scale = 0.85;
    const tx = cw * (1 - scale) / 2;
    const ty = ch * (1 - scale) / 2;

    this.svg.transition().duration(300).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  destroy(): void {
    d3.select(this.container).selectAll('*').remove();
  }
}
