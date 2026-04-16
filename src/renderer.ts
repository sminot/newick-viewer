import * as d3 from 'd3';
import { LayoutResult, LayoutNode, StyleOptions, LayoutType, TreeNode } from './types';
import { pruneNode, extractSubtree, rerootAt, ladderize, toNewick } from './newick-parser';
import type { TipColorMap, MetadataTable } from './metadata';

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/** Format leaf names: replace underscores with spaces (Newick convention) */
function formatLeafName(name: string): string {
  return name.replace(/_/g, ' ');
}

function escapeForTooltip(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type TreeEditAction = 'flip' | 'prune' | 'keep' | 'reroot' | 'ladderize-desc' | 'ladderize-asc';

export interface RendererOptions {
  container: HTMLElement;
  layout: LayoutResult;
  style: StyleOptions;
  layoutType: LayoutType;
  onTreeEdit?: (newRoot: TreeNode, action: TreeEditAction) => void;
  root?: TreeNode;
  /** Optional tip color map from CSV metadata */
  tipColorMap?: TipColorMap | null;
  /** Full metadata table for tooltips */
  metadataTable?: MetadataTable | null;
  /** Which column in the metadata table holds tip IDs */
  metadataIdColumn?: string;
}

export class TreeRenderer {
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom!: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private container: HTMLElement;
  private style: StyleOptions;
  private layoutType: LayoutType;
  private currentLayout: LayoutResult | null = null;
  private onTreeEdit?: (newRoot: TreeNode, action: TreeEditAction) => void;
  private root?: TreeNode;
  private contextMenu: HTMLElement | null = null;
  private tipColorMap?: TipColorMap | null;
  private metadataTable?: MetadataTable | null;
  private metadataIdColumn?: string;
  private tooltip: HTMLElement | null = null;
  private dismissContextMenuBound = () => this.dismissContextMenu();

  constructor(private options: RendererOptions) {
    this.container = options.container;
    this.style = options.style;
    this.layoutType = options.layoutType;
    this.onTreeEdit = options.onTreeEdit;
    this.root = options.root;
    this.tipColorMap = options.tipColorMap;
    this.metadataTable = options.metadataTable;
    this.metadataIdColumn = options.metadataIdColumn;
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
    this.addSearchBox();
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

  private addSearchBox(): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-search';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search taxa...';
    input.className = 'tree-search-input';

    let searchTimer: ReturnType<typeof setTimeout>;
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = input.value.trim().toLowerCase();
        this.highlightSearch(query);
      }, 150);
    });

    wrapper.appendChild(input);
    this.container.appendChild(wrapper);
  }

  private highlightSearch(query: string): void {
    if (!query) {
      // Clear all highlights
      this.g.selectAll('text.leaf-label')
        .attr('font-weight', null)
        .attr('opacity', null);
      this.g.selectAll('rect.search-highlight').remove();
      return;
    }

    this.g.selectAll('rect.search-highlight').remove();

    this.g.selectAll('text.leaf-label').each(function () {
      const el = d3.select(this);
      const text = (el.text() || '').toLowerCase();
      const matches = text.includes(query);

      el.attr('font-weight', matches ? '700' : null)
        .attr('opacity', matches ? null : '0.3');

      if (matches) {
        const bbox = (this as SVGTextElement).getBBox();
        const parent = (this as SVGTextElement).parentNode;
        if (parent) {
          d3.select(parent as Element).insert('rect', ':first-child')
            .attr('class', 'search-highlight')
            .attr('x', bbox.x - 2)
            .attr('y', bbox.y - 1)
            .attr('width', bbox.width + 4)
            .attr('height', bbox.height + 2)
            .attr('rx', 2)
            .attr('fill', '#fff3cd')
            .attr('opacity', 0.8);
        }
      }
    });
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

    // Tip color lookup: check both raw name and underscore-to-space variants
    const tcm = this.tipColorMap?.colorByTip;
    const tipColor = (name: string): string => {
      if (!tcm) return this.style.leafLabelColor;
      return tcm.get(name) ?? tcm.get(name.replace(/_/g, ' ')) ?? tcm.get(name.replace(/ /g, '_')) ?? this.style.leafLabelColor;
    };

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
        .attr('fill', (d) => tipColor(d.node.name))
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
        .attr('fill', (d) => tipColor(d.node.name))
        .attr('font-style', 'italic')
        .text((d) => formatLeafName(d.node.name));
    }

    // Tooltip on hover for leaf labels
    this.attachLeafTooltips(nodeGroup);

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

    // Leaf node dots (colored by metadata if available)
    const hasTipColors = tcm && tcm.size > 0;
    nodeGroup.selectAll('circle.leaf-node')
      .data(leafNodes)
      .enter()
      .append('circle')
      .attr('class', 'leaf-node')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', hasTipColors ? 4 : 2)
      .attr('fill', (d) => tipColor(d.node.name));

    // Legend (when tip colors are active)
    if (hasTipColors && this.tipColorMap?.legend) {
      this.renderLegend();
    }

    // Interactive node hit targets (click to flip, right-click for context menu)
    const allClickableNodes = [...internalNodes, ...leafNodes];
    const editCallback = this.onTreeEdit;
    const root = this.root;
    const self = this;

    if (editCallback && root) {
      nodeGroup.selectAll('circle.node-target')
        .data(allClickableNodes)
        .enter()
        .append('circle')
        .attr('class', 'node-target')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', isTouchDevice() ? 12 : 6)
        .attr('fill', 'transparent')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer')
        .on('mouseenter', function () {
          d3.select(this).attr('fill', 'rgba(0,0,0,0.06)').attr('stroke', '#71767a');
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill', 'transparent').attr('stroke', 'transparent');
        })
        .on('click', function (_event, d) {
          if (d.node.children.length > 0) {
            d.node.children.reverse();
            editCallback(root, 'flip');
          }
        })
        .on('contextmenu', function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          self.showContextMenu(event.clientX, event.clientY, d.node, root);
        })
        .each(function (d) {
          // Long-press for touch devices (500ms)
          let longPressTimer: ReturnType<typeof setTimeout> | null = null;
          const el = this as SVGCircleElement;
          el.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
              longPressTimer = null;
              const touch = e.touches[0];
              if (touch) {
                e.preventDefault();
                self.showContextMenu(touch.clientX, touch.clientY, d.node, root);
              }
            }, 500);
          }, { passive: false });
          el.addEventListener('touchend', () => {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          });
          el.addEventListener('touchmove', () => {
            if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
          });
        });

      // Dismiss context menu on click anywhere
      document.addEventListener('click', this.dismissContextMenuBound);
    }

    // Remove any stale tooltip from previous render
    if (this.tooltip) { this.tooltip.remove(); this.tooltip = null; }

    // Scale bar (rectangular layout only, when branch lengths exist)
    if (this.layoutType === 'rectangular') {
      this.renderScaleBar(layout);
    }
  }

  private renderLegend(): void {
    if (!this.tipColorMap?.legend.length) return;

    // Use the bounding box of the existing tree content to place legend to the right
    const svgNode = this.g.node();
    if (!svgNode) return;
    const bbox = svgNode.getBBox();
    const legendMargin = 30;
    const x0 = bbox.x + bbox.width + legendMargin;
    const y0 = bbox.y + 10;
    const fontSize = this.style.legendLabelSize;
    const rowHeight = fontSize + 6;
    const dotR = Math.max(3, Math.round(fontSize * 0.45));

    const legendGroup = this.g.append('g').attr('class', 'legend');

    // Semi-transparent background
    const bgHeight = this.tipColorMap.legend.length * rowHeight + 12;
    legendGroup.append('rect')
      .attr('x', x0 - 10)
      .attr('y', y0 - 6)
      .attr('width', 150)
      .attr('height', bgHeight)
      .attr('rx', 4)
      .attr('fill', 'rgba(255,255,255,0.9)')
      .attr('stroke', '#dfe1e2')
      .attr('stroke-width', 1);

    this.tipColorMap.legend.forEach((item, i) => {
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
        .attr('font-family', this.style.fontFamily)
        .attr('fill', '#1b1b1b')
        .text(item.category);
    });
  }

  /** Look up metadata row for a tip name, trying underscore/space variants */
  private getMetadataRow(name: string): Record<string, string> | null {
    if (!this.metadataTable) return null;
    const idCol = this.metadataIdColumn ?? this.metadataTable.headers[0];
    for (const row of this.metadataTable.rows) {
      const id = row[idCol];
      if (id === name || id === name.replace(/_/g, ' ') || id === name.replace(/ /g, '_')) {
        return row;
      }
    }
    return null;
  }

  /** Attach hover tooltips to all leaf labels in the given group */
  private attachLeafTooltips(nodeGroup: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    const self = this;
    nodeGroup.selectAll<SVGTextElement, LayoutNode>('text.leaf-label')
      .on('mouseenter', function (event, d) {
        self.showTooltip(event, d.node);
      })
      .on('mousemove', function (event) {
        self.moveTooltip(event);
      })
      .on('mouseleave', function () {
        self.hideTooltip();
      });
  }

  private showTooltip(event: MouseEvent, node: TreeNode): void {
    this.hideTooltip();

    const tip = document.createElement('div');
    tip.className = 'tip-tooltip';

    const name = formatLeafName(node.name);
    let html = `<div class="tip-tooltip-name">${escapeForTooltip(name)}</div>`;

    if (node.branchLength !== null) {
      html += `<div class="tip-tooltip-row"><span class="tip-tooltip-key">Branch length</span><span>${node.branchLength}</span></div>`;
    }

    const row = this.getMetadataRow(node.name);
    if (row) {
      const idCol = this.metadataTable!.headers[0];
      for (const header of this.metadataTable!.headers) {
        if (header === idCol) continue; // skip the ID column — already shown as name
        const val = row[header];
        if (val) {
          html += `<div class="tip-tooltip-row"><span class="tip-tooltip-key">${escapeForTooltip(header)}</span><span>${escapeForTooltip(val)}</span></div>`;
        }
      }
    }

    tip.innerHTML = html;
    document.body.appendChild(tip);
    this.tooltip = tip;
    this.moveTooltip(event);
  }

  private moveTooltip(event: MouseEvent): void {
    if (!this.tooltip) return;
    const pad = 12;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    // Keep within viewport
    const rect = this.tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = event.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = event.clientY - rect.height - pad;
    this.tooltip.style.left = x + 'px';
    this.tooltip.style.top = y + 'px';
  }

  private hideTooltip(): void {
    if (this.tooltip) { this.tooltip.remove(); this.tooltip = null; }
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

    // Position below the bottommost leaf label
    const leafNodes = layout.nodes.filter((n) => n.node.children.length === 0);
    const maxLeafY = leafNodes.reduce((max, n) => Math.max(max, n.y), 0);
    const labelOffset = this.style.leafLabelSize / 2; // half the text height
    const barY = maxLeafY + labelOffset + 20;
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

  /** Return the current zoom/pan transform */
  getTransform(): d3.ZoomTransform {
    return d3.zoomTransform(this.svg.node()!);
  }

  /** Restore a previously saved zoom/pan transform (no animation) */
  setTransform(t: d3.ZoomTransform): void {
    this.svg.call(this.zoom.transform, t);
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

    // Use the actual rendered bounding box (includes labels + legend)
    const gNode = this.g.node();
    const bbox = gNode ? gNode.getBBox() : null;
    const contentW = bbox ? bbox.width + bbox.x : layout.width;
    const contentH = bbox ? bbox.height + bbox.y : layout.height;

    const scale = Math.min(cw / contentW, ch / contentH) * 0.9;
    const tx = (cw - contentW * scale) / 2;
    const ty = (ch - contentH * scale) / 2;

    this.svg.transition().duration(300).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }

  private showContextMenu(x: number, y: number, node: TreeNode, root: TreeNode): void {
    this.dismissContextMenu();
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const isInternal = node.children.length > 0;
    const isRoot = node === root;
    const nodeName = node.name
      ? node.name.replace(/_/g, ' ')
      : (isInternal ? 'this clade' : 'this leaf');

    const items: { label: string; action: TreeEditAction; disabled?: boolean }[] = [];

    if (isInternal) {
      items.push({ label: 'Flip children', action: 'flip' });
      items.push({ label: 'Ladderize (large first)', action: 'ladderize-desc' });
      items.push({ label: 'Ladderize (small first)', action: 'ladderize-asc' });
    }
    if (!isRoot) {
      items.push({ label: `Remove ${nodeName}`, action: 'prune' });
    }
    if (isInternal && !isRoot) {
      items.push({ label: `Keep only ${nodeName}`, action: 'keep' });
      items.push({ label: `Reroot here`, action: 'reroot' });
    }

    for (const item of items) {
      const el = document.createElement('div');
      el.className = 'tree-context-menu-item';
      el.textContent = item.label;
      el.addEventListener('click', () => {
        this.dismissContextMenu();
        this.executeAction(item.action, node, root);
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);
    this.contextMenu = menu;

    // Keep menu in viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
    });
  }

  private dismissContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  private executeAction(action: TreeEditAction, node: TreeNode, root: TreeNode): void {
    if (!this.onTreeEdit) return;

    let newRoot = root;
    switch (action) {
      case 'flip':
        node.children.reverse();
        break;
      case 'ladderize-desc':
        ladderize(node, false);
        break;
      case 'ladderize-asc':
        ladderize(node, true);
        break;
      case 'prune': {
        const result = pruneNode(root, node);
        if (!result) return; // Can't prune root
        newRoot = result;
        break;
      }
      case 'keep':
        newRoot = extractSubtree(node);
        newRoot.branchLength = null;
        break;
      case 'reroot':
        newRoot = rerootAt(root, node);
        break;
    }
    this.onTreeEdit(newRoot, action);
  }

  destroy(): void {
    this.dismissContextMenu();
    this.hideTooltip();
    document.removeEventListener('click', this.dismissContextMenuBound);
    d3.select(this.container).selectAll('*').remove();
  }
}
