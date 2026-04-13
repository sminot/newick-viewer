import * as d3 from 'd3';
import { LayoutResult, StyleOptions, LayoutType } from './types';
import { getMaxBranchLength } from './newick-parser';

/** Format leaf names: replace underscores with spaces (Newick convention) */
function formatLeafName(name: string): string {
  return name.replace(/_/g, ' ');
}

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
  private currentLayout: LayoutResult | null = null;

  constructor(private options: RendererOptions) {
    this.container = options.container;
    this.style = options.style;
    this.layoutType = options.layoutType;
    this.init();
    this.render(options.layout);
  }

  private init(): void {
    d3.select(this.container).selectAll('*').remove();

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('class', 'tree-svg');

    this.g = this.svg.append('g').attr('class', 'tree-group');

    this.zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Add zoom controls overlay
    this.addZoomControls();
  }

  private addZoomControls(): void {
    const controls = document.createElement('div');
    controls.className = 'zoom-controls';

    const btnFit = document.createElement('button');
    btnFit.className = 'zoom-btn';
    btnFit.title = 'Fit to view';
    btnFit.textContent = 'Fit';
    btnFit.addEventListener('click', () => {
      if (this.currentLayout) this.fitToView(this.currentLayout);
    });

    const btnIn = document.createElement('button');
    btnIn.className = 'zoom-btn';
    btnIn.title = 'Zoom in';
    btnIn.textContent = '+';
    btnIn.addEventListener('click', () => {
      this.svg.transition().duration(200).call(this.zoom.scaleBy, 1.4);
    });

    const btnOut = document.createElement('button');
    btnOut.className = 'zoom-btn';
    btnOut.title = 'Zoom out';
    btnOut.textContent = '\u2212'; // minus sign
    btnOut.addEventListener('click', () => {
      this.svg.transition().duration(200).call(this.zoom.scaleBy, 1 / 1.4);
    });

    controls.append(btnIn, btnOut, btnFit);
    this.container.appendChild(controls);
  }

  render(layout: LayoutResult): void {
    this.currentLayout = layout;
    this.g.selectAll('*').remove();

    // Draw edges
    const edgeGroup = this.g.append('g').attr('class', 'edges');

    if (this.layoutType === 'rectangular') {
      edgeGroup.selectAll('path.branch')
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
        .attr('stroke', this.style.branchColor)
        .attr('stroke-width', this.style.branchWidth);
    } else {
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
        .attr('font-style', 'italic')
        .text((d) => formatLeafName(d.node.name));
    } else {
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
        .attr('font-style', 'italic')
        .text((d) => formatLeafName(d.node.name));
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
        .attr('x', (d) => {
          if (this.layoutType === 'rectangular') {
            // Position along the horizontal segment of the elbow connector
            return ((d.x + (d.parentX ?? d.x)) / 2);
          }
          // Radial: midpoint between node and parent
          return ((d.x + (d.parentX ?? d.x)) / 2);
        })
        .attr('y', (d) => {
          if (this.layoutType === 'rectangular') {
            // The horizontal segment is at the child's Y, offset label above it
            return d.y - 4;
          }
          return ((d.y + (d.parentY ?? d.y)) / 2) - 4;
        })
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

    // Scale bar (rectangular layout only, when branch lengths exist)
    if (this.layoutType === 'rectangular') {
      this.renderScaleBar(layout);
    }
  }

  private renderScaleBar(layout: LayoutResult): void {
    // Check if any node has branch lengths
    const hasBranchLengths = layout.nodes.some((n) => n.node.branchLength !== null);
    if (!hasBranchLengths) return;

    // Find the root node to compute scale
    const rootNode = layout.nodes.find((n) => n.parentX === null);
    if (!rootNode) return;

    // Find max branch length sum
    const maxBL = layout.nodes
      .filter((n) => n.node.children.length === 0)
      .reduce((max, n) => Math.max(max, n.x), 0);
    const minX = rootNode.x;
    const plotWidth = maxBL - minX;
    if (plotWidth <= 0) return;

    // Find actual max branch length from tree for scaling
    const tree = rootNode.node;
    const totalBranchLen = this.getMaxBranchLengthFromTree(tree);
    if (totalBranchLen <= 0) return;

    // Choose a nice round scale bar value
    const pixelsPerUnit = plotWidth / totalBranchLen;
    const targetBarPx = 80;
    const targetBarValue = targetBarPx / pixelsPerUnit;
    const scaleBarValue = this.niceRound(targetBarValue);
    const scaleBarPx = scaleBarValue * pixelsPerUnit;

    // Position at bottom-left of the tree area
    const barY = layout.height - 15;
    const barX = minX;

    const scaleGroup = this.g.append('g').attr('class', 'scale-bar');

    scaleGroup.append('line')
      .attr('x1', barX)
      .attr('y1', barY)
      .attr('x2', barX + scaleBarPx)
      .attr('y2', barY)
      .attr('stroke', this.style.branchColor)
      .attr('stroke-width', this.style.branchWidth);

    // Tick marks at ends
    scaleGroup.append('line')
      .attr('x1', barX).attr('y1', barY - 3)
      .attr('x2', barX).attr('y2', barY + 3)
      .attr('stroke', this.style.branchColor)
      .attr('stroke-width', this.style.branchWidth);

    scaleGroup.append('line')
      .attr('x1', barX + scaleBarPx).attr('y1', barY - 3)
      .attr('x2', barX + scaleBarPx).attr('y2', barY + 3)
      .attr('stroke', this.style.branchColor)
      .attr('stroke-width', this.style.branchWidth);

    scaleGroup.append('text')
      .attr('x', barX + scaleBarPx / 2)
      .attr('y', barY - 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', (this.style.internalLabelSize) + 'px')
      .attr('font-family', this.style.fontFamily)
      .attr('fill', this.style.branchColor)
      .text(scaleBarValue < 0.001 ? scaleBarValue.toExponential(0) : String(scaleBarValue));
  }

  private getMaxBranchLengthFromTree(node: any): number {
    if (!node.children || node.children.length === 0) return 0;
    return Math.max(
      ...node.children.map(
        (child: any) => (child.branchLength ?? 1) + this.getMaxBranchLengthFromTree(child)
      )
    );
  }

  private niceRound(value: number): number {
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const normalized = value / base;
    if (normalized < 1.5) return base;
    if (normalized < 3.5) return 2 * base;
    if (normalized < 7.5) return 5 * base;
    return 10 * base;
  }

  getCurrentLayout(): LayoutResult | null {
    return this.currentLayout;
  }

  resetZoom(): void {
    this.svg.transition().duration(300).call(
      this.zoom.transform,
      d3.zoomIdentity
    );
  }

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
