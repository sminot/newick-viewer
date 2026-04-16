import './style.css';
import { parseNewick, parseTreeInput, getLeafNames, getMaxBranchLength, toNewick } from './newick-parser';
import { computeLayout } from './layout';
import { TreeRenderer } from './renderer';
import { TanglegramRenderer } from './tanglegram';
import { ViewState, DEFAULT_STYLE, TreeNode } from './types';
import { getStateFromURL, setStateInURL, getShareableURL, defaultViewState } from './state';
import { exportStandaloneHTML, exportPDF, exportSVG } from './export';
import { autocompleteName, matchNames, getInducedSubtree, getSubtree } from './opentree';
import { parseCSV, buildTipColorMap, MetadataTable, TipColorMap } from './metadata';

// Example trees — a random one is loaded when "Load example" is clicked
const EXAMPLES: { name: string; tree1: string; tree2?: string; metadata?: string }[] = [
  {
    name: 'Primates',
    tree1: '((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,Papio_anubis:0.0365):0.0150);',
    tree2: '((((Pan_troglodytes:0.0075,Homo_sapiens:0.0070):0.0028,Gorilla_gorilla:0.0092):0.0100,(Pongo_abelii:0.0188,Hylobates_lar:0.0225):0.0035):0.0355,(Papio_anubis:0.0372,Macaca_mulatta:0.0368):0.0155);',
    metadata: 'name,family\nHomo_sapiens,Hominidae\nPan_troglodytes,Hominidae\nGorilla_gorilla,Hominidae\nPongo_abelii,Hominidae\nHylobates_lar,Hylobatidae\nMacaca_mulatta,Cercopithecidae\nPapio_anubis,Cercopithecidae',
  },
  {
    name: 'Mammals',
    tree1: '(((((Cow:0.2143,Pig:0.1480):0.0851,Horse:0.1658):0.0586,Cat:0.2648):0.0381,(((Human:0.0110,Chimp:0.0285):0.0113,Rhesus:0.0221):0.1010,Rabbit:0.2100):0.0250):0.3408,(Rat:0.0510,Mouse:0.0980):0.2790);',
    metadata: 'name,order\nCow,Artiodactyla\nPig,Artiodactyla\nHorse,Perissodactyla\nCat,Carnivora\nHuman,Primates\nChimp,Primates\nRhesus,Primates\nRabbit,Lagomorpha\nRat,Rodentia\nMouse,Rodentia',
  },
  {
    name: 'Carnivores',
    tree1: '((((Dog:0.0850,Wolf:0.0120):0.0600,(Fox:0.0920,Arctic_fox:0.0880):0.0550):0.1200,((Cat:0.0780,Lion:0.0910):0.0450,(Tiger:0.0870,Leopard:0.0830):0.0480):0.0900):0.0350,((Bear:0.1100,Panda:0.1250):0.0800,(Raccoon:0.1400,Red_panda:0.1350):0.0750):0.0600);',
    metadata: 'name,family\nDog,Canidae\nWolf,Canidae\nFox,Canidae\nArctic_fox,Canidae\nCat,Felidae\nLion,Felidae\nTiger,Felidae\nLeopard,Felidae\nBear,Ursidae\nPanda,Ursidae\nRaccoon,Procyonidae\nRed_panda,Ailuridae',
  },
  {
    name: 'Birds',
    tree1: '((((Chicken:0.0800,Turkey:0.0750):0.0450,(Duck:0.0900,Goose:0.0850):0.0500):0.1200,((Eagle:0.0650,Hawk:0.0700):0.0550,(Falcon:0.0680,Kestrel:0.0720):0.0580):0.0800):0.0600,(Ostrich:0.1500,(Penguin:0.1200,Albatross:0.1100):0.0400):0.0900);',
    metadata: 'name,group\nChicken,Galliformes\nTurkey,Galliformes\nDuck,Anseriformes\nGoose,Anseriformes\nEagle,Raptors\nHawk,Raptors\nFalcon,Raptors\nKestrel,Raptors\nOstrich,Ratites\nPenguin,Seabirds\nAlbatross,Seabirds',
  },
  {
    name: 'Fish',
    tree1: '(((Zebrafish:0.2200,(Salmon:0.1800,Trout:0.1750):0.0300):0.0800,((Cod:0.1900,Tilapia:0.2000):0.0600,(Tuna:0.1700,Swordfish:0.1650):0.0550):0.0400):0.1500,(Shark:0.3200,(Ray:0.2800,Skate:0.2900):0.0500):0.1000);',
    metadata: 'name,class\nZebrafish,Actinopterygii\nSalmon,Actinopterygii\nTrout,Actinopterygii\nCod,Actinopterygii\nTilapia,Actinopterygii\nTuna,Actinopterygii\nSwordfish,Actinopterygii\nShark,Chondrichthyes\nRay,Chondrichthyes\nSkate,Chondrichthyes',
  },
  {
    name: 'Flowering plants',
    tree1: '((((Arabidopsis:0.1500,Brassica:0.1600):0.0800,(Tomato:0.1400,Potato:0.1350):0.0750):0.1200,((Rice:0.1100,Wheat:0.1050):0.0500,(Maize:0.1200,Sorghum:0.1150):0.0480):0.0900):0.0700,((Grape:0.1800,Citrus:0.1900):0.0650,(Sunflower:0.2000,Lettuce:0.1950):0.0600):0.0800);',
    metadata: 'name,type\nArabidopsis,Eudicot\nBrassica,Eudicot\nTomato,Eudicot\nPotato,Eudicot\nRice,Monocot\nWheat,Monocot\nMaize,Monocot\nSorghum,Monocot\nGrape,Eudicot\nCitrus,Eudicot\nSunflower,Eudicot\nLettuce,Eudicot',
  },
  {
    name: 'Bacteria',
    tree1: '(((Escherichia_coli:0.0500,Salmonella:0.0600):0.0800,(Vibrio:0.1000,Pseudomonas:0.1200):0.0700):0.1500,((Bacillus:0.1100,Staphylococcus:0.1300):0.0900,((Streptococcus:0.1000,Lactobacillus:0.1150):0.0600,(Clostridium:0.1400,Mycobacterium:0.1800):0.0800):0.0500):0.1200);',
    metadata: 'name,gram\nEscherichia_coli,Negative\nSalmonella,Negative\nVibrio,Negative\nPseudomonas,Negative\nBacillus,Positive\nStaphylococcus,Positive\nStreptococcus,Positive\nLactobacillus,Positive\nClostridium,Positive\nMycobacterium,Acid-fast',
  },
  {
    name: 'Fungi',
    tree1: '(((Saccharomyces:0.2100,(Candida:0.2300,Pichia:0.2200):0.0400):0.1000,((Aspergillus:0.1800,Penicillium:0.1750):0.0600,(Neurospora:0.1900,Fusarium:0.2000):0.0550):0.0800):0.0700,(Agaricus:0.2500,(Coprinus:0.2400,Pleurotus:0.2350):0.0350):0.1100);',
    metadata: 'name,phylum\nSaccharomyces,Ascomycota\nCandida,Ascomycota\nPichia,Ascomycota\nAspergillus,Ascomycota\nPenicillium,Ascomycota\nNeurospora,Ascomycota\nFusarium,Ascomycota\nAgaricus,Basidiomycota\nCoprinus,Basidiomycota\nPleurotus,Basidiomycota',
  },
  {
    name: 'Insects',
    tree1: '((((Drosophila:0.1200,Musca:0.1350):0.0700,(Aedes:0.1400,Anopheles:0.1300):0.0650):0.0900,((Apis:0.1100,Bombus:0.1050):0.0500,(Formica:0.1250,Solenopsis:0.1300):0.0550):0.0800):0.0600,((Tribolium:0.1500,Leptinotarsa:0.1600):0.0750,(Bombyx:0.1400,(Papilio:0.1200,Danaus:0.1150):0.0300):0.0850):0.0700);',
    metadata: 'name,order\nDrosophila,Diptera\nMusca,Diptera\nAedes,Diptera\nAnopheles,Diptera\nApis,Hymenoptera\nBombus,Hymenoptera\nFormica,Hymenoptera\nSolenopsis,Hymenoptera\nTribolium,Coleoptera\nLeptinotarsa,Coleoptera\nBombyx,Lepidoptera\nPapilio,Lepidoptera\nDanaus,Lepidoptera',
  },
  {
    name: 'Dinosaurs (hypothetical)',
    tree1: '((((Tyrannosaurus:0.0800,Allosaurus:0.1200):0.0500,(Velociraptor:0.0700,Deinonychus:0.0650):0.0600):0.0900,((Triceratops:0.1100,Styracosaurus:0.1050):0.0450,(Stegosaurus:0.1300,Ankylosaurus:0.1250):0.0500):0.0800):0.0400,((Brachiosaurus:0.1500,Diplodocus:0.1400):0.0350,(Apatosaurus:0.1450,Argentinosaurus:0.1600):0.0400):0.0700);',
    metadata: 'name,diet\nTyrannosaurus,Carnivore\nAllosaurus,Carnivore\nVelociraptor,Carnivore\nDeinonychus,Carnivore\nTriceratops,Herbivore\nStyracosaurus,Herbivore\nStegosaurus,Herbivore\nAnkylosaurus,Herbivore\nBrachiosaurus,Herbivore\nDiplodocus,Herbivore\nApatosaurus,Herbivore\nArgentinosaurus,Herbivore',
  },
];

let lastExampleIndex = -1;

let state: ViewState;
let currentRenderer: TreeRenderer | null = null;
let currentTanglegram: TanglegramRenderer | null = null;

// Metadata state
let metadataTable: MetadataTable | null = null;
let currentTipColorMap: TipColorMap | null = null;
let metadataIdColumn: string = '';
let metadataCategoryColumn: string = '';

/** Sync metadata fields into the persisted ViewState */
function syncMetadataToState(): void {
  if (metadataTable) {
    // Re-serialize from the parsed table to get clean CSV
    const rows = metadataTable.rows.map(r => metadataTable!.headers.map(h => r[h] ?? '').join(','));
    state.metadata = [metadataTable.headers.join(','), ...rows].join('\n');
    state.metadataIdCol = metadataIdColumn;
    state.metadataCatCol = metadataCategoryColumn;
  } else {
    state.metadata = undefined;
    state.metadataIdCol = undefined;
    state.metadataCatCol = undefined;
  }
}

// Undo/redo history for tree edits
const undoStack: string[] = [];
const redoStack: string[] = [];
const MAX_HISTORY = 50;

// Track whether the first render has happened (for mobile auto-collapse)
let hasRenderedOnce = false;
let lastRenderedNewick = ''; // Track tree content to detect structural changes

/** Push the current newick1 onto the undo stack (call before making a change) */
function pushUndo(): void {
  if (state.newick1) {
    undoStack.push(state.newick1);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
  }
  redoStack.length = 0; // clear redo on new action
  updateUndoRedoButtons();
}

function canUndo(): boolean { return undoStack.length > 0; }
function canRedo(): boolean { return redoStack.length > 0; }

/** Update just the disabled state of undo/redo toolbar buttons */
function updateUndoRedoButtons(): void {
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement | null;
  if (btnUndo) btnUndo.disabled = !canUndo();
  if (btnRedo) btnRedo.disabled = !canRedo();
}

function undo(): void {
  if (!canUndo()) return;
  redoStack.push(state.newick1);
  state.newick1 = undoStack.pop()!;
  syncTextarea('newick-input-1', state.newick1);
  renderTree();
  updateUndoRedoButtons();
}

function redo(): void {
  if (!canRedo()) return;
  undoStack.push(state.newick1);
  state.newick1 = redoStack.pop()!;
  syncTextarea('newick-input-1', state.newick1);
  renderTree();
  updateUndoRedoButtons();
}

function init(): void {
  // Try to restore state from URL
  state = getStateFromURL() ?? defaultViewState();

  // Restore metadata from URL state
  if (state.metadata) {
    try {
      metadataTable = parseCSV(state.metadata);
      metadataIdColumn = state.metadataIdCol ?? metadataTable.headers[0] ?? '';
      metadataCategoryColumn = state.metadataCatCol ?? metadataTable.headers[1] ?? '';
      if (metadataTable.headers.length >= 2) {
        currentTipColorMap = buildTipColorMap(metadataTable, metadataIdColumn, metadataCategoryColumn);
      }
    } catch { /* ignore corrupt metadata in URL */ }
  }

  buildToolbar();
  buildOpenTreePanel();
  buildInputPanel();
  buildMetadataPanel();
  buildControlsPanel();
  setupDragDrop();
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
    // Ctrl/Cmd+Z to undo (only when not focused on textarea)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      const active = document.activeElement;
      if (active?.tagName !== 'TEXTAREA' && active?.tagName !== 'INPUT') {
        e.preventDefault();
        undo();
      }
    }
    // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y to redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y') && !(e.key === 'y' && e.shiftKey)) {
      const active = document.activeElement;
      if (active?.tagName !== 'TEXTAREA' && active?.tagName !== 'INPUT') {
        e.preventDefault();
        redo();
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
    const tree1 = parseTreeInput(state.newick1);
    const viewerRect = viewer.getBoundingClientRect();
    const autoW = viewerRect.width || 900;
    const autoH = viewerRect.height || 600;

    // Use user-specified dimensions or auto-compute from viewer/leaf count
    const leafCount = getLeafNames(tree1).length;
    const w = state.style.canvasWidth > 0 ? state.style.canvasWidth : autoW;
    const treeHeight = state.style.canvasHeight > 0
      ? state.style.canvasHeight
      : Math.max(autoH, leafCount * (state.style.leafLabelSize + 8));

    if (state.tanglegram && state.newick2) {
      // Tanglegram mode
      if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }
      const tree2 = parseTreeInput(state.newick2);

      const leaves2 = getLeafNames(tree2).length;
      const maxLeaves = Math.max(leafCount, leaves2);
      const tangleHeight = Math.max(autoH, maxLeaves * (state.style.leafLabelSize + 8));

      if (currentTanglegram) currentTanglegram.destroy();
      currentTanglegram = new TanglegramRenderer({
        container: viewer,
        tree1,
        tree2,
        style: state.style,
        tanglegramStyle: state.tanglegramStyle,
        onNodeFlip: () => {
          pushUndo();
          syncTreeToTextarea(tree1, tree2);
          currentTanglegram!.render();
        },
      });
    } else {
      // Single tree mode
      if (currentTanglegram) { currentTanglegram.destroy(); currentTanglegram = null; }

      const layout = computeLayout(tree1, state.layout, w, treeHeight);

      // Preserve zoom/pan transform across re-renders
      const prevTransform = currentRenderer ? currentRenderer.getTransform() : null;

      if (currentRenderer) currentRenderer.destroy();
      currentRenderer = new TreeRenderer({
        container: viewer,
        layout,
        style: state.style,
        layoutType: state.layout,
        root: tree1,
        tipColorMap: currentTipColorMap,
        onTreeEdit: (newRoot) => {
          pushUndo();
          const newick = toNewick(newRoot) + ';';
          state.newick1 = newick;
          syncTextarea('newick-input-1', newick);
          // Full re-render (tree structure may have changed)
          renderTree();
        },
      });

      // Preserve zoom/pan for style-only changes; fit to view for new trees
      const treeChanged = state.newick1 !== lastRenderedNewick;
      if (prevTransform && hasRenderedOnce && !treeChanged) {
        currentRenderer.setTransform(prevTransform);
      } else {
        currentRenderer.fitToView(layout);
      }
    }

    lastRenderedNewick = state.newick1;

    // Show tree stats
    const maxBL = getMaxBranchLength(tree1);
    showTreeStats(getLeafNames(tree1).length, maxBL);

    clearError();
    setStateInURL(state);

    // On mobile, auto-collapse sidebar on the first render so the user sees the tree
    if (!hasRenderedOnce && window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.classList.contains('collapsed')) {
        sidebar.classList.add('collapsed');
      }
    }
    hasRenderedOnce = true;
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
  title.textContent = 'Tree Viewer';
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
    buildControlsPanel();
    renderTree();
  });
  toolbar.appendChild(btnTangle);

  addSeparator(toolbar);

  // Undo/Redo
  const undoRedoGroup = document.createElement('div');
  undoRedoGroup.className = 'toolbar-group';

  const btnUndo = document.createElement('button');
  btnUndo.id = 'btn-undo';
  btnUndo.className = 'btn-secondary';
  btnUndo.textContent = '\u21A9'; // ↩
  btnUndo.title = 'Undo (Ctrl+Z)';
  btnUndo.disabled = !canUndo();
  btnUndo.style.fontSize = '16px';
  btnUndo.addEventListener('click', undo);

  const btnRedo = document.createElement('button');
  btnRedo.id = 'btn-redo';
  btnRedo.className = 'btn-secondary';
  btnRedo.textContent = '\u21AA'; // ↪
  btnRedo.title = 'Redo (Ctrl+Shift+Z)';
  btnRedo.disabled = !canRedo();
  btnRedo.style.fontSize = '16px';
  btnRedo.addEventListener('click', redo);

  undoRedoGroup.append(btnUndo, btnRedo);
  toolbar.appendChild(undoRedoGroup);

  // Sidebar toggle
  const btnSidebar = document.createElement('button');
  btnSidebar.className = 'btn-secondary';
  btnSidebar.textContent = '\u2630'; // ☰ hamburger
  btnSidebar.title = 'Toggle sidebar';
  btnSidebar.style.fontSize = '16px';
  btnSidebar.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar')!;
    sidebar.classList.toggle('collapsed');
  });
  toolbar.appendChild(btnSidebar);

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

function buildOpenTreePanel(): void {
  const panel = document.getElementById('opentree-panel')!;
  panel.innerHTML = '';

  const h3 = document.createElement('h3');
  h3.textContent = 'Open Tree of Life';
  panel.appendChild(h3);

  // Search mode: subtree (single taxon) or induced (multiple taxa)
  const modeRow = document.createElement('div');
  modeRow.className = 'input-row';
  modeRow.style.marginBottom = '8px';

  const modeLabel = document.createElement('span');
  modeLabel.style.fontSize = '12px';
  modeLabel.style.color = 'var(--text-secondary)';
  modeLabel.textContent = 'Mode:';

  const modeSelect = document.createElement('select');
  modeSelect.className = 'sidebar-select';
  modeSelect.innerHTML = '<option value="subtree">Subtree (single taxon)</option><option value="induced">Induced tree (multiple taxa)</option>';
  modeSelect.style.flex = '1';

  modeRow.append(modeLabel, modeSelect);
  panel.appendChild(modeRow);

  // Search input with autocomplete
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'opentree-search';
  searchInput.placeholder = 'Search taxon name...';
  searchInput.className = 'opentree-search-input';
  panel.appendChild(searchInput);

  // Autocomplete dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'opentree-dropdown';
  dropdown.id = 'opentree-dropdown';
  panel.appendChild(dropdown);

  // Selected taxa list (for induced subtree mode)
  const selectedDiv = document.createElement('div');
  selectedDiv.id = 'opentree-selected';
  selectedDiv.className = 'opentree-selected';
  panel.appendChild(selectedDiv);

  // Depth limit (for subtree mode)
  const depthRow = document.createElement('label');
  depthRow.id = 'opentree-depth-row';
  const depthSpan = document.createElement('span');
  depthSpan.textContent = 'Depth limit';
  const depthInput = document.createElement('input');
  depthInput.type = 'number';
  depthInput.id = 'opentree-depth';
  depthInput.min = '1';
  depthInput.max = '10';
  depthInput.value = '3';
  depthRow.append(depthSpan, depthInput);
  panel.appendChild(depthRow);

  // Load button
  const btnRow = document.createElement('div');
  btnRow.className = 'input-row';
  const btnLoad = document.createElement('button');
  btnLoad.className = 'primary';
  btnLoad.textContent = 'Load from OpenTree';
  btnLoad.id = 'opentree-load';
  btnRow.appendChild(btnLoad);
  panel.appendChild(btnRow);

  // Status/error area
  const statusDiv = document.createElement('div');
  statusDiv.id = 'opentree-status';
  panel.appendChild(statusDiv);

  // --- Wire up interactions ---
  const selectedTaxa: { name: string; ott_id: number }[] = [];
  let debounceTimer: ReturnType<typeof setTimeout>;

  function renderSelected() {
    selectedDiv.innerHTML = '';
    if (modeSelect.value !== 'induced' || selectedTaxa.length === 0) return;
    for (const taxon of selectedTaxa) {
      const tag = document.createElement('span');
      tag.className = 'opentree-tag';
      tag.textContent = taxon.name;
      const removeBtn = document.createElement('span');
      removeBtn.className = 'opentree-tag-remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => {
        const idx = selectedTaxa.indexOf(taxon);
        if (idx >= 0) selectedTaxa.splice(idx, 1);
        renderSelected();
      });
      tag.appendChild(removeBtn);
      selectedDiv.appendChild(tag);
    }
  }

  function updateModeVisibility() {
    const depthRowEl = document.getElementById('opentree-depth-row')!;
    depthRowEl.style.display = modeSelect.value === 'subtree' ? '' : 'none';
    renderSelected();
  }

  modeSelect.addEventListener('change', updateModeVisibility);
  updateModeVisibility();

  // Autocomplete on typing (with AbortController to cancel stale requests)
  let autocompleteController: AbortController | null = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    if (autocompleteController) autocompleteController.abort();
    const query = searchInput.value.trim();
    if (query.length < 2) {
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
      return;
    }
    debounceTimer = setTimeout(async () => {
      autocompleteController = new AbortController();
      try {
        const results = await autocompleteName(query, 'All life', autocompleteController.signal);
        dropdown.innerHTML = '';
        if (results.length === 0) {
          dropdown.style.display = 'none';
          return;
        }
        for (const r of results.slice(0, 10)) {
          const item = document.createElement('div');
          item.className = 'opentree-dropdown-item';
          item.textContent = r.unique_name;
          if (r.is_higher) {
            const badge = document.createElement('span');
            badge.className = 'opentree-badge';
            badge.textContent = 'clade';
            item.appendChild(badge);
          }
          item.addEventListener('click', () => {
            if (modeSelect.value === 'induced') {
              if (!selectedTaxa.some((t) => t.ott_id === r.ott_id)) {
                selectedTaxa.push({ name: r.unique_name, ott_id: r.ott_id });
                renderSelected();
              }
              searchInput.value = '';
            } else {
              searchInput.value = r.unique_name;
              searchInput.dataset.ottId = String(r.ott_id);
            }
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        }
        dropdown.style.display = '';
      } catch {
        dropdown.innerHTML = '';
        dropdown.style.display = 'none';
      }
    }, 250);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target as Node)) {
      dropdown.style.display = 'none';
    }
  });

  // Load button
  btnLoad.addEventListener('click', async () => {
    const statusEl = document.getElementById('opentree-status')!;
    statusEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Loading...</div>';
    btnLoad.disabled = true;

    try {
      let newick: string;

      if (modeSelect.value === 'induced') {
        if (selectedTaxa.length < 2) {
          throw new Error('Select at least 2 taxa for an induced subtree');
        }
        const ottIds = selectedTaxa.map((t) => t.ott_id);
        const result = await getInducedSubtree(ottIds);
        newick = result.newick;
      } else {
        // Subtree mode
        const ottIdStr = searchInput.dataset.ottId;
        if (!ottIdStr) {
          // Try matching the text input
          const matches = await matchNames([searchInput.value.trim()]);
          if (matches.length === 0) throw new Error('No matching taxon found');
          searchInput.dataset.ottId = String(matches[0].ott_id);
        }
        const ottId = parseInt(searchInput.dataset.ottId!, 10);
        const depth = parseInt((document.getElementById('opentree-depth') as HTMLInputElement).value, 10) || 3;
        const result = await getSubtree(ottId, depth);
        newick = result.newick;
      }

      if (!newick) throw new Error('Empty tree returned from OpenTree');

      // Load into the main textarea and render
      pushUndo();
      state.newick1 = newick;
      const ta1 = document.getElementById('newick-input-1') as HTMLTextAreaElement;
      if (ta1) ta1.value = newick;
      renderTree();

      statusEl.innerHTML = '<div style="font-size:12px;color:var(--success-green,#2e8540);margin-top:6px;">Tree loaded successfully</div>';
      setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
    } catch (e: any) {
      statusEl.innerHTML = `<div class="error-message">${escapeHtml(e.message || 'Failed to load from OpenTree')}</div>`;
    } finally {
      btnLoad.disabled = false;
    }
  });
}

function buildInputPanel(): void {
  const panel = document.getElementById('input-panel')!;
  panel.innerHTML = '';

  const h3 = document.createElement('h3');
  h3.textContent = state.tanglegram ? 'Tree 1 (Newick)' : 'Newick Input';
  panel.appendChild(h3);

  // Tree 1 textarea with auto-render on change
  const ta1 = document.createElement('textarea');
  ta1.id = 'newick-input-1';
  ta1.placeholder = 'Paste Newick or NEXUS format, e.g.:\n((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);';
  ta1.value = state.newick1;
  ta1.rows = 4;
  let inputTimer1: ReturnType<typeof setTimeout>;
  ta1.addEventListener('input', () => {
    clearTimeout(inputTimer1);
    inputTimer1 = setTimeout(() => {
      const newVal = ta1.value.trim();
      if (newVal !== state.newick1) {
        pushUndo();
        state.newick1 = newVal;
        renderTree();
      }
    }, 400);
  });
  panel.appendChild(ta1);

  // File upload for tree 1
  const fileDiv1 = document.createElement('div');
  fileDiv1.className = 'file-input-wrapper';
  const fileLabel1 = document.createElement('label');
  fileLabel1.className = 'file-input-label';
  fileLabel1.textContent = 'Choose .nwk file or drag & drop';
  const fileInput1 = document.createElement('input');
  fileInput1.type = 'file';
  fileInput1.accept = '.nwk,.tree,.txt,.newick,.nex,.nexus,.nxs';
  fileInput1.addEventListener('change', () => {
    const file = fileInput1.files?.[0];
    if (file) {
      file.text().then((text) => {
        pushUndo();
        ta1.value = text.trim();
        state.newick1 = text.trim();
        renderTree();
      });
    }
  });
  fileLabel1.appendChild(fileInput1);
  fileDiv1.appendChild(fileLabel1);
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
    let inputTimer2: ReturnType<typeof setTimeout>;
    ta2.addEventListener('input', () => {
      clearTimeout(inputTimer2);
      inputTimer2 = setTimeout(() => {
        state.newick2 = ta2.value.trim();
        renderTree();
      }, 400);
    });
    panel.appendChild(ta2);

    const fileDiv2 = document.createElement('div');
    fileDiv2.className = 'file-input-wrapper';
    const fileLabel2 = document.createElement('label');
    fileLabel2.className = 'file-input-label';
    fileLabel2.textContent = 'Choose .nwk file or drag & drop';
    const fileInput2 = document.createElement('input');
    fileInput2.type = 'file';
    fileInput2.accept = '.nwk,.tree,.txt,.newick,.nex,.nexus,.nxs';
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
    fileLabel2.appendChild(fileInput2);
    fileDiv2.appendChild(fileLabel2);
    panel.appendChild(fileDiv2);
  }

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'input-row';

  const btnExample = document.createElement('button');
  btnExample.textContent = 'Load example';
  btnExample.addEventListener('click', () => {
    pushUndo();
    // Pick a random example different from the last one
    let idx: number;
    do {
      idx = Math.floor(Math.random() * EXAMPLES.length);
    } while (idx === lastExampleIndex && EXAMPLES.length > 1);
    lastExampleIndex = idx;
    const ex = EXAMPLES[idx];

    ta1.value = ex.tree1;
    state.newick1 = ex.tree1;
    if (state.tanglegram) {
      const ta2El = document.getElementById('newick-input-2') as HTMLTextAreaElement;
      if (ta2El) {
        const tree2 = ex.tree2 ?? ex.tree1;
        ta2El.value = tree2;
        state.newick2 = tree2;
      }
    }
    // Load example metadata if available
    if (ex.metadata) {
      try {
        metadataTable = parseCSV(ex.metadata);
        metadataIdColumn = metadataTable.headers[0];
        metadataCategoryColumn = metadataTable.headers[1];
        currentTipColorMap = buildTipColorMap(metadataTable, metadataIdColumn, metadataCategoryColumn);
        buildMetadataPanel();
      } catch { /* ignore metadata errors */ }
    } else {
      metadataTable = null;
      currentTipColorMap = null;
      buildMetadataPanel();
    }
    syncMetadataToState();
    renderTree();
    showToast(ex.name);
  });

  btnRow.append(btnExample);
  panel.appendChild(btnRow);

  // Error display area
  const errDiv = document.createElement('div');
  errDiv.id = 'error-display';
  panel.appendChild(errDiv);
}

function buildMetadataPanel(): void {
  const panel = document.getElementById('metadata-panel')!;
  panel.innerHTML = '';

  const h3 = document.createElement('h3');
  h3.textContent = 'Tip Metadata';
  panel.appendChild(h3);

  if (!metadataTable) {
    // Upload prompt
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:8px;';
    desc.textContent = 'Upload a CSV or TSV file to color tips by category. The file should have a column matching tip names and a column for the category.';
    panel.appendChild(desc);

    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-input-wrapper';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'file-input-label';
    fileLabel.textContent = 'Choose .csv or .tsv file';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.tsv,.txt';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        try {
          metadataTable = parseCSV(text);
          // Auto-select first column as ID, second as category
          if (metadataTable.headers.length >= 2) {
            metadataIdColumn = metadataTable.headers[0];
            metadataCategoryColumn = metadataTable.headers[1];
            currentTipColorMap = buildTipColorMap(metadataTable, metadataIdColumn, metadataCategoryColumn);
          }
          syncMetadataToState();
          buildMetadataPanel();
          renderTree();
        } catch (e: any) {
          panel.innerHTML += `<div class="error-message">${escapeHtml(e.message)}</div>`;
        }
      });
    });
    fileLabel.appendChild(fileInput);
    fileDiv.appendChild(fileLabel);
    panel.appendChild(fileDiv);
  } else {
    // Column selectors
    const idRow = document.createElement('label');
    const idSpan = document.createElement('span');
    idSpan.textContent = 'Tip ID column';
    const idSelect = document.createElement('select');
    idSelect.className = 'sidebar-select';
    idSelect.style.flex = '1';
    for (const h of metadataTable.headers) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === metadataIdColumn) opt.selected = true;
      idSelect.appendChild(opt);
    }
    idRow.append(idSpan, idSelect);
    panel.appendChild(idRow);

    const catRow = document.createElement('label');
    const catSpan = document.createElement('span');
    catSpan.textContent = 'Category column';
    const catSelect = document.createElement('select');
    catSelect.className = 'sidebar-select';
    catSelect.style.flex = '1';
    for (const h of metadataTable.headers) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h === metadataCategoryColumn) opt.selected = true;
      catSelect.appendChild(opt);
    }
    catRow.append(catSpan, catSelect);
    panel.appendChild(catRow);

    // Update on column change
    const updateColors = () => {
      metadataIdColumn = idSelect.value;
      metadataCategoryColumn = catSelect.value;
      currentTipColorMap = buildTipColorMap(metadataTable!, metadataIdColumn, metadataCategoryColumn);
      syncMetadataToState();
      renderTree();
    };
    idSelect.addEventListener('change', updateColors);
    catSelect.addEventListener('change', updateColors);

    // Stats
    const stats = document.createElement('div');
    stats.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:6px;';
    const nCategories = currentTipColorMap?.legend.length ?? 0;
    const nMapped = currentTipColorMap?.colorByTip.size ?? 0;
    stats.textContent = `${nMapped} tips mapped, ${nCategories} categories`;
    panel.appendChild(stats);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear metadata';
    clearBtn.style.marginTop = '8px';
    clearBtn.addEventListener('click', () => {
      metadataTable = null;
      currentTipColorMap = null;
      metadataIdColumn = '';
      metadataCategoryColumn = '';
      syncMetadataToState();
      buildMetadataPanel();
      renderTree();
    });
    panel.appendChild(clearBtn);
  }
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
    debouncedRenderTree();
  });

  // Branch width
  addRangeControl(panel, 'Branch width (px)', state.style.branchWidth, 0.5, 5, 0.5, (v) => {
    state.style.branchWidth = v;
    debouncedRenderTree();
  });

  // Leaf label size
  addRangeControl(panel, 'Label size (px)', state.style.leafLabelSize, 6, 28, 1, (v) => {
    state.style.leafLabelSize = v;
    debouncedRenderTree();
  });

  // Label color
  addColorControl(panel, 'Label color', state.style.leafLabelColor, (v) => {
    state.style.leafLabelColor = v;
    debouncedRenderTree();
  });

  // Tree dimensions (auto checkbox + stepper)
  const viewer = document.getElementById('viewer')!;
  addDimensionControl(panel, 'Tree width', state.style.canvasWidth,
    () => viewer.getBoundingClientRect().width || 900,
    100, 8000, 100, (v) => {
      state.style.canvasWidth = v;
      debouncedRenderTree();
    });

  addDimensionControl(panel, 'Tree height', state.style.canvasHeight,
    () => {
      const rect = viewer.getBoundingClientRect();
      return rect.height || 600;
    },
    100, 8000, 100, (v) => {
      state.style.canvasHeight = v;
      debouncedRenderTree();
    });

  // Separator between style and toggle controls
  const controlsSep = document.createElement('div');
  controlsSep.className = 'controls-separator';
  panel.appendChild(controlsSep);

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

  // Tanglegram-specific controls (only shown when tanglegram is active)
  if (state.tanglegram) {
    const tangleSep = document.createElement('div');
    tangleSep.className = 'controls-separator';
    panel.appendChild(tangleSep);

    const h3t = document.createElement('h3');
    h3t.textContent = 'Tanglegram Connections';
    panel.appendChild(h3t);

    // Spacing between trees
    addRangeControl(panel, 'Tree spacing', state.tanglegramStyle.spacing, 0.05, 0.6, 0.01, (v) => {
      state.tanglegramStyle.spacing = v;
      debouncedRenderTree();
    });

    // Connection color mode toggle
    addSelectControl(panel, 'Color mode', state.tanglegramStyle.connectionColorMode,
      [{ value: 'single', label: 'Single color' }, { value: 'multi', label: 'Multi-color' }],
      (v) => {
        state.tanglegramStyle.connectionColorMode = v as 'single' | 'multi';
        buildControlsPanel(); // Rebuild to show/hide color picker
        renderTree();
      }
    );

    // Connection color (only when single-color mode)
    if (state.tanglegramStyle.connectionColorMode === 'single') {
      addColorControl(panel, 'Connection color', state.tanglegramStyle.connectionColor, (v) => {
        state.tanglegramStyle.connectionColor = v;
        debouncedRenderTree();
      });
    }

    // Connection line width
    addRangeControl(panel, 'Connection width', state.tanglegramStyle.connectionWidth, 0.5, 4, 0.5, (v) => {
      state.tanglegramStyle.connectionWidth = v;
      debouncedRenderTree();
    });

    // Connection line style
    addSelectControl(panel, 'Line style', state.tanglegramStyle.connectionLineStyle,
      [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }],
      (v) => {
        state.tanglegramStyle.connectionLineStyle = v as 'solid' | 'dashed' | 'dotted';
        renderTree();
      }
    );
  }
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

function addDimensionControl(
  parent: HTMLElement,
  label: string,
  value: number,
  getAutoValue: () => number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void
): void {
  const row = document.createElement('div');
  row.className = 'dimension-row';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'dimension-label';
  labelSpan.textContent = label;

  const autoLabel = document.createElement('label');
  autoLabel.className = 'dimension-auto';
  const autoCheck = document.createElement('input');
  autoCheck.type = 'checkbox';
  autoCheck.checked = value === 0;
  const autoText = document.createElement('span');
  autoText.textContent = 'Auto';
  autoLabel.append(autoCheck, autoText);

  const wrapper = document.createElement('div');
  wrapper.className = 'stepper';

  const btnMinus = document.createElement('button');
  btnMinus.type = 'button';
  btnMinus.className = 'stepper-btn';
  btnMinus.textContent = '\u2212';

  const num = document.createElement('input');
  num.type = 'number';
  num.min = String(min);
  num.max = String(max);
  num.step = String(step);

  const btnPlus = document.createElement('button');
  btnPlus.type = 'button';
  btnPlus.className = 'stepper-btn';
  btnPlus.textContent = '+';

  function setDisabled(isAuto: boolean) {
    num.disabled = isAuto;
    btnMinus.disabled = isAuto;
    btnPlus.disabled = isAuto;
    wrapper.classList.toggle('disabled', isAuto);
    if (isAuto) {
      num.value = String(Math.round(getAutoValue()));
    }
  }

  num.value = value === 0 ? String(Math.round(getAutoValue())) : String(value);
  setDisabled(value === 0);

  autoCheck.addEventListener('change', () => {
    if (autoCheck.checked) {
      num.value = String(Math.round(getAutoValue()));
      onChange(0);
    } else {
      const autoVal = Math.round(getAutoValue());
      num.value = String(autoVal);
      onChange(autoVal);
    }
    setDisabled(autoCheck.checked);
  });

  btnMinus.addEventListener('click', (e) => {
    e.preventDefault();
    if (autoCheck.checked) return;
    const v = Math.max(min, parseFloat(num.value) - step);
    num.value = String(v);
    onChange(v);
  });
  btnPlus.addEventListener('click', (e) => {
    e.preventDefault();
    if (autoCheck.checked) return;
    const v = Math.min(max, parseFloat(num.value) + step);
    num.value = String(v);
    onChange(v);
  });
  num.addEventListener('change', () => {
    if (autoCheck.checked) return;
    const v = Math.max(min, Math.min(max, parseFloat(num.value) || min));
    num.value = String(v);
    onChange(v);
  });

  wrapper.append(btnMinus, num, btnPlus);
  row.append(labelSpan, autoLabel, wrapper);
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

function addSelectControl(
  parent: HTMLElement,
  label: string,
  value: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => void
): void {
  const row = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = label;
  const select = document.createElement('select');
  select.className = 'sidebar-select';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.value === value) el.selected = true;
    select.appendChild(el);
  }
  select.addEventListener('change', () => onChange(select.value));
  row.append(span, select);
  parent.appendChild(row);
}

/** Update a textarea's value without triggering input events */
function syncTextarea(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLTextAreaElement;
  if (el) el.value = value;
}

/** Sync both tree textareas after a tanglegram edit */
function syncTreeToTextarea(tree1: TreeNode, tree2: TreeNode): void {
  state.newick1 = toNewick(tree1) + ';';
  state.newick2 = toNewick(tree2) + ';';
  syncTextarea('newick-input-1', state.newick1);
  syncTextarea('newick-input-2', state.newick2);
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

/** Debounced render for style controls (avoids re-layout on every slider tick) */
let styleRenderTimer: ReturnType<typeof setTimeout>;
function debouncedRenderTree(): void {
  clearTimeout(styleRenderTimer);
  styleRenderTimer = setTimeout(renderTree, 80);
}

/** Setup drag-and-drop support on the viewer and sidebar */
function setupDragDrop(): void {
  const viewer = document.getElementById('viewer')!;
  const sidebar = document.getElementById('sidebar')!;

  for (const el of [viewer, sidebar]) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');

      const file = e.dataTransfer?.files[0];
      if (!file) return;

      file.text().then((text) => {
        pushUndo();
        const trimmed = text.trim();
        const ta1 = document.getElementById('newick-input-1') as HTMLTextAreaElement;
        if (ta1) ta1.value = trimmed;
        state.newick1 = trimmed;
        renderTree();
        showToast('File loaded: ' + file.name);
      });
    });
  }
}

/** Show tree statistics after rendering */
function showTreeStats(leafCount: number, maxBranchLen: number): void {
  // Remove old stats
  const viewer = document.getElementById('viewer')!;
  viewer.querySelectorAll('.tree-stats').forEach((el) => el.remove());

  const stats = document.createElement('div');
  stats.className = 'tree-stats';

  const parts: string[] = [];
  parts.push(`${leafCount} taxa`);
  if (maxBranchLen > 0) {
    parts.push(`max depth: ${maxBranchLen < 0.001 ? maxBranchLen.toExponential(2) : maxBranchLen.toFixed(4)}`);
  }

  stats.textContent = parts.join('  \u00B7  ');
  viewer.appendChild(stats);
}

// Start
document.addEventListener('DOMContentLoaded', init);
