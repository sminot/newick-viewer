import * as d3 from 'd3';
import { LayoutResult, StyleOptions, LayoutType } from './types';

export interface RendererOptions {
  container: HTMLElement;
  layout: LayoutResult;
  style: StyleOptions;
  layoutType: LayoutType;
}

export class TreeRenderer {
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private container: HTMLElement;
  private style: StyleOptions;
  private layoutType: LayoutType;

  constructor(private options: RendererOptions) {
    this.container = options.container;
    this.style = options.style;
    this.layoutType = options.layoutType;
    this.init();
    this.render(options.layout);
  }

  private init(): void {
    // Clear previous content
    d3.select(this.container).selectAll('*').remove();

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('class', 'tree-svg');

    this.g = this.svg.append('g').attr('class', 'tree-group');

    // Set up zoom/pan
    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);
  }

  render(layout: LayoutResult): void {
    this.g.selectAll('*').remove();

    // Draw edges
    const edgeGroup = this.g.append('g').attr('class', 'edges');

    if (this.layoutType === 'rectangular') {
      // Rectangular layout: draw elbow connectors
      edgeGroup.selectAll('path.branch')
        .data(layout.edges)
        .enter()
        .append('path')
        .attr('class', 'branch')
        .attr('d', (d) => {
          if (d.elbowX !== undefined && d.elbowY !== undefined) {
            // Horizontal from parent, then vertical to child Y, then horizontal to child
            return `M${d.sourceX},${d.sourceY} V${d.elbowY} H${d.targetX}`;
          }
          return `M${d.sourceX},${d.sourceY} L${d.targetX},${d.targetY}`;
        })
        .attr('fill', 'none')
        .attr('stroke', this.style.branchColor)
        .attr('stroke-width', this.style.branchWidth);
    } else {
      // Radial layout: straight lines
      edgeGroup.selectAll('line.branch')
        .data(layout.edges)
        .enter()
        .append('line')
        .attr('class', 'branch')
        .attr('x1', (d) => d.sourceX)
        .attr('y1', (d) => d.sourceY)
        .attr('x2', (d) => d.targetX)
        .attr('y2', (d) => d.targetY)
        .attr('stroke', this.style.branchColor)
        .attr('stroke-width', this.style.branchWidth);
    }

    // Draw nodes
    const nodeGroup = this.g.append('g').attr('class', 'nodes');

    // Leaf labels
    const leafNodes = layout.nodes.filter((n) => n.node.children.length === 0);
    const internalNodes = layout.nodes.filter((n) => n.node.children.length > 0);

    if (this.layoutType === 'rectangular') {
      nodeGroup.selectAll('text.leaf-label')
        .data(leafNodes)
        .enter()
        .append('text')
        .attr('class', 'leaf-label')
        .attr('x', (d) => d.x + 6)
        .attr('y', (d) => d.y)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'start')
        .attr('font-size', this.style.leafLabelSize + 'px')
        .attr('font-family', this.style.fontFamily)
        .attr('fill', this.style.leafLabelColor)
        .text((d) => d.node.name);
    } else {
      // Radial: rotate labels to follow angle
      const cx = layout.width / 2;
      const cy = layout.height / 2;
      nodeGroup.selectAll('text.leaf-label')
        .data(leafNodes)
        .enter()
        .append('text')
        .attr('class', 'leaf-label')
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y)
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => {
          const angle = Math.atan2(d.y - cy, d.x - cx);
          return Math.abs(angle) > Math.PI / 2 ? 'end' : 'start';
        })
        .attr('transform', (d) => {
          const angle = Math.atan2(d.y - cy, d.x - cx);
          let deg = (angle * 180) / Math.PI;
          const flip = Math.abs(deg) > 90;
          if (flip) deg += 180;
          return `rotate(${deg},${d.x},${d.y})`;
        })
        .attr('dx', (d) => {
          const angle = Math.atan2(d.y - cy, d.x - cx);
          return Math.abs(angle) > Math.PI / 2 ? '-6' : '6';
        })
        .attr('font-size', this.style.leafLabelSize + 'px')
        .attr('font-family', this.style.fontFamily)
        .attr('fill', this.style.leafLabelColor)
        .text((d) => d.node.name);
    }

    // Internal node labels
    if (this.style.showInternalLabels) {
      nodeGroup.selectAll('text.internal-label')
        .data(internalNodes.filter((n) => n.node.name))
        .enter()
        .append('text')
        .attr('class', 'internal-label')
        .attr('x', (d) => d.x)
        .attr('y', (d) => d.y - 6)
        .attr('text-anchor', 'middle')
        .attr('font-size', this.style.internalLabelSize + 'px')
        .attr('font-family', this.style.fontFamily)
        .attr('fill', '#666')
        .text((d) => d.node.name);
    }

    // Branch length labels
    if (this.style.showBranchLengths) {
      const branchNodes = layout.nodes.filter(
        (n) => n.node.branchLength !== null && n.parentX !== null
      );
      nodeGroup.selectAll('text.branch-length')
        .data(branchNodes)
        .enter()
        .append('text')
        .attr('class', 'branch-length')
        .attr('x', (d) => ((d.x + (d.parentX ?? d.x)) / 2))
        .attr('y', (d) => ((d.y + (d.parentY ?? d.y)) / 2) - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', (this.style.internalLabelSize - 1) + 'px')
        .attr('font-family', this.style.fontFamily)
        .attr('fill', '#999')
        .text((d) => d.node.branchLength?.toFixed(4) ?? '');
    }

    // Leaf node dots
    nodeGroup.selectAll('circle.leaf-node')
      .data(leafNodes)
      .enter()
      .append('circle')
      .attr('class', 'leaf-node')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', 2)
      .attr('fill', this.style.branchColor);
  }

  /** Reset zoom to fit the tree */
  resetZoom(): void {
    this.svg.transition().duration(300).call(
      this.zoom.transform,
      d3.zoomIdentity
    );
  }

  /** Fit tree to container */
  fitToView(layout: LayoutResult): void {
    const containerRect = this.container.getBoundingClientRect();
    const cw = containerRect.width;
    const ch = containerRect.height;

    const scale = Math.min(cw / layout.width, ch / layout.height) * 0.9;
    const tx = (cw - layout.width * scale) / 2;
    const ty = (ch - layout.height * scale) / 2;

    this.svg.transition().duration(300).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  destroy(): void {
    d3.select(this.container).selectAll('*').remove();
  }
}
