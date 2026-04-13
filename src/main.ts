import './style.css';
import { parseNewick, getLeafNames } from './newick-parser';
import { computeLayout } from './layout';
import { TreeRenderer } from './renderer';
import { TanglegramRenderer } from './tanglegram';
import { ViewState, DEFAULT_STYLE } from './types';
import { getStateFromURL, setStateInURL, getShareableURL, defaultViewState } from './state';
import { exportStandaloneHTML, exportPDF, exportSVG } from './export';

// Example trees for demo
const EXAMPLE_TREE_1 = '((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,Papio_anubis:0.0365):0.0150);';
const EXAMPLE_TREE_2 = '((((Pan_troglodytes:0.0075,Homo_sapiens:0.0070):0.0028,Gorilla_gorilla:0.0092):0.0100,(Pongo_abelii:0.0188,Hylobates_lar:0.0225):0.0035):0.0355,(Papio_anubis:0.0372,Macaca_mulatta:0.0368):0.0155);';

let state: ViewState;
let currentRenderer: TreeRenderer | null = null;
let currentTanglegram: TanglegramRenderer | null = null;

function init(): void {
  // Try to restore state from URL
  state = getStateFromURL() ?? defaultViewState();

  buildToolbar();
  buildInputPanel();
  buildControlsPanel();
  renderTree();

  // Debounced resize handler
  const viewer = document.getElementById('viewer')!;
  let resizeTimer: ReturnType<typeof setTimeout>;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.newick1) renderTree();
    }, 150);
  });
  ro.observe(viewer);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+Enter to render
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const ta1 = document.getElementById('newick-input-1') as HTMLTextAreaElement;
      if (ta1) {
        state.newick1 = ta1.value.trim();
        if (state.tanglegram) {
          const ta2 = document.getElementById('newick-input-2') as HTMLTextAreaElement;
          state.newick2 = ta2?.value.trim() ?? '';
        }
        renderTree();
      }
    }
    // Ctrl/Cmd+0 to fit to view
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      if (currentRenderer && currentRenderer.getCurrentLayout()) {
        currentRenderer.fitToView(currentRenderer.getCurrentLayout()!);
      }
    }
  });
}

function showPlaceholderIfEmpty(): void {
  const viewer = document.getElementById('viewer')!;
  if (!state.newick1) {
    // Clear everything in the viewer
    if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }
    if (currentTanglegram) { currentTanglegram.destroy(); currentTanglegram = null; }
    viewer.querySelectorAll('svg, .viewer-message').forEach((el) => el.remove());

    const msg = document.createElement('div');
    msg.className = 'viewer-message';
    msg.innerHTML = `
      <div>Paste a Newick tree in the sidebar to get started</div>
      <div class="hint">Or click "Load example" for a demo</div>
      <div class="hint" style="margin-top: 16px; font-size: 11px; color: #bbb;">Scroll to zoom &middot; Drag to pan &middot; Ctrl+Enter to render</div>
    `;
    viewer.appendChild(msg);
  }
}

function renderTree(): void {
  const viewer = document.getElementById('viewer')!;

  // Remove placeholder
  viewer.querySelectorAll('.viewer-message').forEach((el) => el.remove());

  if (!state.newick1) {
    showPlaceholderIfEmpty();
    return;
  }

  try {
    const tree1 = parseNewick(state.newick1);
    const viewerRect = viewer.getBoundingClientRect();
    const w = viewerRect.width || 900;
    const h = viewerRect.height || 600;

    // Compute tree dimensions based on leaf count
    const leafCount = getLeafNames(tree1).length;
    const treeHeight = Math.max(h, leafCount * (state.style.leafLabelSize + 8));

    if (state.tanglegram && state.newick2) {
      // Tanglegram mode
      if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }
      const tree2 = parseNewick(state.newick2);

      const leaves2 = getLeafNames(tree2).length;
      const maxLeaves = Math.max(leafCount, leaves2);
      const tangleHeight = Math.max(h, maxLeaves * (state.style.leafLabelSize + 8));

      if (currentTanglegram) currentTanglegram.destroy();
      currentTanglegram = new TanglegramRenderer({
        container: viewer,
        tree1,
        tree2,
        style: state.style,
      });
    } else {
      // Single tree mode
      if (currentTanglegram) { currentTanglegram.destroy(); currentTanglegram = null; }

      const layout = computeLayout(tree1, state.layout, w, treeHeight);

      if (currentRenderer) currentRenderer.destroy();
      currentRenderer = new TreeRenderer({
        container: viewer,
        layout,
        style: state.style,
        layoutType: state.layout,
      });

      // Auto-fit if the tree is taller than the viewer
      if (treeHeight > h) {
        currentRenderer.fitToView(layout);
      }
    }

    clearError();
    setStateInURL(state);
  } catch (e: any) {
    showError(e.message || 'Failed to parse Newick string');
  }
}

function buildToolbar(): void {
  const toolbar = document.getElementById('toolbar')!;
  toolbar.innerHTML = '';

  // App title
  const title = document.createElement('span');
  title.className = 'app-title';
  title.textContent = 'Newick Viewer';
  toolbar.appendChild(title);

  // Layout toggle group (primary actions)
  const layoutGroup = document.createElement('div');
  layoutGroup.className = 'toolbar-group';

  const btnRect = document.createElement('button');
  btnRect.textContent = 'Rectangular';
  btnRect.className = state.layout === 'rectangular' ? 'active' : '';
  btnRect.addEventListener('click', () => {
    state.layout = 'rectangular';
    buildToolbar();
    renderTree();
  });

  const btnRadial = document.createElement('button');
  btnRadial.textContent = 'Radial';
  btnRadial.className = state.layout === 'radial' ? 'active' : '';
  btnRadial.addEventListener('click', () => {
    state.layout = 'radial';
    buildToolbar();
    renderTree();
  });

  layoutGroup.append(btnRect, btnRadial);
  toolbar.appendChild(layoutGroup);

  addSeparator(toolbar);

  // Tanglegram toggle
  const btnTangle = document.createElement('button');
  btnTangle.textContent = 'Tanglegram';
  btnTangle.className = state.tanglegram ? 'active' : '';
  btnTangle.addEventListener('click', () => {
    state.tanglegram = !state.tanglegram;
    buildToolbar();
    buildInputPanel();
    renderTree();
  });
  toolbar.appendChild(btnTangle);

  // Spacer pushes export actions to the right
  const spacer = document.createElement('div');
  spacer.className = 'toolbar-spacer';
  toolbar.appendChild(spacer);

  // Share button (prominent)
  const btnCopy = document.createElement('button');
  btnCopy.textContent = 'Copy link';
  btnCopy.title = 'Copy shareable URL to clipboard';
  btnCopy.addEventListener('click', () => {
    const url = getShareableURL(state);
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard'));
  });
  toolbar.appendChild(btnCopy);

  addSeparator(toolbar);

  // Export dropdown-like group (secondary actions, visually subdued)
  const exportGroup = document.createElement('div');
  exportGroup.className = 'toolbar-group export-group';

  const exportLabel = document.createElement('span');
  exportLabel.className = 'toolbar-label';
  exportLabel.textContent = 'Export:';

  const btnSVG = document.createElement('button');
  btnSVG.className = 'btn-secondary';
  btnSVG.textContent = 'SVG';
  btnSVG.addEventListener('click', () => {
    exportSVG(document.getElementById('viewer')!);
  });

  const btnHTML = document.createElement('button');
  btnHTML.className = 'btn-secondary';
  btnHTML.textContent = 'HTML';
  btnHTML.addEventListener('click', () => {
    exportStandaloneHTML(document.getElementById('viewer')!);
  });

  const btnPDF = document.createElement('button');
  btnPDF.className = 'btn-secondary';
  btnPDF.textContent = 'PDF';
  btnPDF.addEventListener('click', () => {
    exportPDF(document.getElementById('viewer')!);
  });

  exportGroup.append(exportLabel, btnSVG, btnHTML, btnPDF);
  toolbar.appendChild(exportGroup);
}

function addSeparator(parent: HTMLElement): void {
  const sep = document.createElement('div');
  sep.className = 'toolbar-separator';
  parent.appendChild(sep);
}

function buildInputPanel(): void {
  const panel = document.getElementById('input-panel')!;
  panel.innerHTML = '';

  const h3 = document.createElement('h3');
  h3.textContent = state.tanglegram ? 'Tree 1 (Newick)' : 'Newick Input';
  panel.appendChild(h3);

  // Tree 1 textarea
  const ta1 = document.createElement('textarea');
  ta1.id = 'newick-input-1';
  ta1.placeholder = '((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);';
  ta1.value = state.newick1;
  ta1.rows = 4;
  panel.appendChild(ta1);

  // File upload for tree 1
  const fileDiv1 = document.createElement('div');
  fileDiv1.className = 'file-input-wrapper';
  const fileInput1 = document.createElement('input');
  fileInput1.type = 'file';
  fileInput1.accept = '.nwk,.tree,.txt,.newick';
  fileInput1.addEventListener('change', () => {
    const file = fileInput1.files?.[0];
    if (file) {
      file.text().then((text) => {
        ta1.value = text.trim();
        state.newick1 = text.trim();
        renderTree();
      });
    }
  });
  fileDiv1.appendChild(fileInput1);
  panel.appendChild(fileDiv1);

  // Tree 2 (for tanglegram)
  if (state.tanglegram) {
    const h3b = document.createElement('h3');
    h3b.textContent = 'Tree 2 (Newick)';
    h3b.style.marginTop = '12px';
    panel.appendChild(h3b);

    const ta2 = document.createElement('textarea');
    ta2.id = 'newick-input-2';
    ta2.placeholder = '((C:0.3,A:0.1):0.2,(B:0.4,D:0.5):0.6);';
    ta2.value = state.newick2;
    ta2.rows = 4;
    panel.appendChild(ta2);

    const fileDiv2 = document.createElement('div');
    fileDiv2.className = 'file-input-wrapper';
    const fileInput2 = document.createElement('input');
    fileInput2.type = 'file';
    fileInput2.accept = '.nwk,.tree,.txt,.newick';
    fileInput2.addEventListener('change', () => {
      const file = fileInput2.files?.[0];
      if (file) {
        file.text().then((text) => {
          ta2.value = text.trim();
          state.newick2 = text.trim();
          renderTree();
        });
      }
    });
    fileDiv2.appendChild(fileInput2);
    panel.appendChild(fileDiv2);
  }

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'input-row';

  const btnRender = document.createElement('button');
  btnRender.className = 'primary';
  btnRender.textContent = 'Render tree';
  btnRender.addEventListener('click', () => {
    state.newick1 = ta1.value.trim();
    if (state.tanglegram) {
      const ta2El = document.getElementById('newick-input-2') as HTMLTextAreaElement;
      state.newick2 = ta2El?.value.trim() ?? '';
    }
    renderTree();
  });

  const btnExample = document.createElement('button');
  btnExample.textContent = 'Load example';
  btnExample.addEventListener('click', () => {
    ta1.value = EXAMPLE_TREE_1;
    state.newick1 = EXAMPLE_TREE_1;
    if (state.tanglegram) {
      const ta2El = document.getElementById('newick-input-2') as HTMLTextAreaElement;
      if (ta2El) {
        ta2El.value = EXAMPLE_TREE_2;
        state.newick2 = EXAMPLE_TREE_2;
      }
    }
    renderTree();
  });

  btnRow.append(btnRender, btnExample);
  panel.appendChild(btnRow);

  // Error display area
  const errDiv = document.createElement('div');
  errDiv.id = 'error-display';
  panel.appendChild(errDiv);
}

function buildControlsPanel(): void {
  const panel = document.getElementById('controls-panel')!;
  panel.innerHTML = '';

  const h3 = document.createElement('h3');
  h3.textContent = 'Display Settings';
  panel.appendChild(h3);

  // Branch color
  addColorControl(panel, 'Branch color', state.style.branchColor, (v) => {
    state.style.branchColor = v;
    renderTree();
  });

  // Branch width
  addRangeControl(panel, 'Branch width', state.style.branchWidth, 0.5, 5, 0.5, (v) => {
    state.style.branchWidth = v;
    renderTree();
  });

  // Leaf label size
  addRangeControl(panel, 'Label size', state.style.leafLabelSize, 6, 28, 1, (v) => {
    state.style.leafLabelSize = v;
    renderTree();
  });

  // Label color
  addColorControl(panel, 'Label color', state.style.leafLabelColor, (v) => {
    state.style.leafLabelColor = v;
    renderTree();
  });

  // Show branch lengths
  addCheckbox(panel, 'Show branch lengths', state.style.showBranchLengths, (v) => {
    state.style.showBranchLengths = v;
    renderTree();
  });

  // Show internal labels
  addCheckbox(panel, 'Show internal labels', state.style.showInternalLabels, (v) => {
    state.style.showInternalLabels = v;
    renderTree();
  });
}

function addColorControl(
  parent: HTMLElement,
  label: string,
  value: string,
  onChange: (v: string) => void
): void {
  const row = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  row.append(span, input);
  parent.appendChild(row);
}

function addRangeControl(
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void
): void {
  const row = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  const num = document.createElement('input');
  num.type = 'number';
  num.min = String(min);
  num.max = String(max);
  num.step = String(step);
  num.value = String(value);
  input.addEventListener('input', () => {
    num.value = input.value;
    onChange(parseFloat(input.value));
  });
  num.addEventListener('change', () => {
    input.value = num.value;
    onChange(parseFloat(num.value));
  });
  row.append(span, input, num);
  parent.appendChild(row);
}

function addCheckbox(
  parent: HTMLElement,
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void
): void {
  const row = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const span = document.createElement('span');
  span.textContent = label;
  input.addEventListener('change', () => onChange(input.checked));
  row.append(input, span);
  parent.appendChild(row);
}

function showError(message: string): void {
  const errDiv = document.getElementById('error-display');
  if (errDiv) {
    errDiv.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
  }
}

function clearError(): void {
  const errDiv = document.getElementById('error-display');
  if (errDiv) errDiv.innerHTML = '';
}

function showToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// Start
document.addEventListener('DOMContentLoaded', init);
