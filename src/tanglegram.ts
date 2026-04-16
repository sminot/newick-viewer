import * as d3 from 'd3';
import { TreeNode, LayoutResult, StyleOptions, TanglegramStyle } from './types';
import { computeLayout } from './layout';
import type { TipColorMap } from './metadata';

export interface TanglegramOptions {
  container: HTMLElement;
  tree1: TreeNode;
  tree2: TreeNode;
  style: StyleOptions;
  tanglegramStyle: TanglegramStyle;
  onNodeFlip?: () => void;
  tipColorMap?: TipColorMap | null;
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

    const { tree1, tree2, style, tanglegramStyle } = this.options;
    const containerRect = this.container.getBoundingClientRect();
    const totalWidth = containerRect.width || 1200;
    const totalHeight = containerRect.height || 800;

    // Use spacing setting to control gap between trees
    const gapFraction = Math.max(0.05, Math.min(0.6, tanglegramStyle.spacing));
    const treeWidth = totalWidth * (1 - gapFraction) / 2;
    const gapWidth = totalWidth * gapFraction;
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

    // Draw left tree, capture label end positions
    const leftLabelEnds = this.drawTree(layout1, style, 'left');

    // Draw right tree, capture label end positions
    const rightLabelEnds = this.drawTree(layout2, style, 'right');

    // Draw connecting lines between matching leaves
    this.drawConnections(leftLabelEnds, rightLabelEnds, tanglegramStyle);

    // Color legend
    const tcm = this.options.tipColorMap;
    if (tcm && tcm.colorByTip.size > 0 && tcm.legend.length > 0) {
      this.renderLegend(tcm);
    }
  }

  private renderLegend(tcm: TipColorMap): void {
    const gNode = this.g.node();
    if (!gNode) return;
    const bbox = gNode.getBBox();
    const legendMargin = 30;
    const x0 = bbox.x + bbox.width + legendMargin;
    const y0 = bbox.y + 10;
    const fontSize = this.options.style.legendLabelSize;
    const rowHeight = fontSize + 6;
    const dotR = Math.max(3, Math.round(fontSize * 0.45));

    const legendGroup = this.g.append('g').attr('class', 'legend');

    tcm.legend.forEach((item, i) => {
      const y = y0 + i * rowHeight + 6;
      legendGroup.append('circle')
        .attr('cx', x0)
        .attr('cy', y)
        .attr('r', dotR)
        .attr('fill', item.color);

      legendGroup.append('text')
        .attr('x', x0 + dotR + 8)
        .attr('y', y)
        .attr('dy', '0.35em')
        .attr('font-size', fontSize + 'px')
        .attr('font-family', this.options.style.fontFamily)
        .attr('fill', '#1b1b1b')
        .text(item.category);
    });

    const contentBBox = legendGroup.node()!.getBBox();
    const bgPadX = 10;
    const bgPadY = 6;
    const bgHeight = tcm.legend.length * rowHeight + 12;
    legendGroup.insert('rect', ':first-child')
      .attr('x', contentBBox.x - bgPadX)
      .attr('y', y0 - bgPadY)
      .attr('width', contentBBox.width + bgPadX * 2)
      .attr('height', bgHeight)
      .attr('rx', 4)
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('stroke', '#dfe1e2')
      .attr('stroke-width', 1);
  }

  /**
   * Draw a tree and return a map of leaf name -> label end x-coordinate.
   * For left tree, label end is the right edge of the text.
   * For right tree, label end is the left edge of the text.
   */
  private drawTree(
    layout: LayoutResult,
    style: StyleOptions,
    side: 'left' | 'right'
  ): Map<string, { x: number; y: number }> {
    const group = this.g.append('g').attr('class', `tree-${side}`);

    // Tip color lookup
    const tcm = this.options.tipColorMap?.colorByTip;
    const tipColor = (name: string): string => {
      if (!tcm) return style.leafLabelColor;
      return tcm.get(name) ?? tcm.get(name.replace(/_/g, ' ')) ?? tcm.get(name.replace(/ /g, '_')) ?? style.leafLabelColor;
    };
    const hasTipColors = tcm && tcm.size > 0;

    // Edges with elbow connectors
    group.selectAll('path.branch')
      .data(layout.edges)
      .enter()
      .append('path')
      .attr('class', 'branch')
      .attr('d', (d) => {
        if (d.elbowX !== undefined && d.elbowY !== undefined) {
          return `M${d.sourceX},${d.sourceY} V${d.elbowY} H${d.targetX}`;
        }
        return `M${d.sourceX},${d.sourceY} L${d.targetX},${d.targetY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', style.branchColor)
      .attr('stroke-width', style.branchWidth);

    // Leaf labels
    const leafNodes = layout.nodes.filter((n) => n.node.children.length === 0);

    const labelSelection = group.selectAll('text.leaf-label')
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
      .attr('fill', (d) => tipColor(d.node.name))
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
      .attr('r', hasTipColors ? 4 : 2)
      .attr('fill', (d) => tipColor(d.node.name));

    // Clickable internal node circles (for flipping child order)
    const internalNodes = layout.nodes.filter((n) => n.node.children.length > 0);
    const flipCallback = this.options.onNodeFlip;
    if (flipCallback) {
      group.selectAll('circle.internal-node')
        .data(internalNodes)
        .enter()
        .append('circle')
        .attr('class', 'internal-node')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', 5)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer')
        .on('mouseenter', function () {
          d3.select(this).attr('fill', '#dfe1e2').attr('stroke', '#71767a');
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill', 'transparent').attr('stroke', 'transparent');
        })
        .on('click', function (_event, d) {
          d.node.children.reverse();
          flipCallback();
        });
    }

    // Measure label bounding boxes to find the end of each label
    const labelEnds = new Map<string, { x: number; y: number }>();
    labelSelection.each(function (d) {
      const bbox = (this as SVGTextElement).getBBox();
      const endX = side === 'left'
        ? bbox.x + bbox.width + 3  // right edge + small pad
        : bbox.x - 3;              // left edge - small pad
      labelEnds.set(d.node.name, { x: endX, y: d.y });
    });

    return labelEnds;
  }

  private drawConnections(
    leftEnds: Map<string, { x: number; y: number }>,
    rightEnds: Map<string, { x: number; y: number }>,
    ts: TanglegramStyle
  ): void {
    const connGroup = this.g.append('g').attr('class', 'connections');

    const matchingNames = [...leftEnds.keys()].filter((name) => rightEnds.has(name));
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Compute stroke-dasharray for line style
    let dasharray: string | undefined;
    switch (ts.connectionLineStyle) {
      case 'dashed': dasharray = '6,4'; break;
      case 'dotted': dasharray = '2,3'; break;
      default: dasharray = undefined;
    }

    matchingNames.forEach((name, i) => {
      const left = leftEnds.get(name)!;
      const right = rightEnds.get(name)!;

      const midX = (left.x + right.x) / 2;
      const strokeColor = ts.connectionColorMode === 'single'
        ? ts.connectionColor
        : colorScale(String(i));

      const path = connGroup.append('path')
        .attr('class', 'connection')
        .attr('d', `M${left.x},${left.y} C${midX},${left.y} ${midX},${right.y} ${right.x},${right.y}`)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', ts.connectionWidth)
        .attr('stroke-opacity', 0.6);

      if (dasharray) {
        path.attr('stroke-dasharray', dasharray);
      }
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
