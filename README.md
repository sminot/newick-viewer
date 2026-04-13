# Newick Tree Viewer

A static web application for viewing phylogenetic trees from Newick format files. Supports interactive zoom/pan, multiple layout modes, tanglegram comparison, and shareable URLs with full state encoding.

Built for biomedical researchers.

## Features

- **Newick parser** — branch lengths, quoted labels, internal node labels, NHX annotations, bootstrap values
- **Rectangular layout** — standard dendrogram with elbow connectors and auto-sizing scale bar
- **Radial layout** — circular tree with rotated labels
- **Tanglegram** — side-by-side tree comparison with color-coded connections between matching taxa
- **Interactive** — scroll to zoom, drag to pan, +/−/Fit controls
- **Style controls** — branch color/width, label size/color, toggle branch lengths and internal labels
- **Shareable URLs** — all visualization state (tree data + settings) compressed into the URL hash via LZ-string
- **Export** — standalone HTML (interactive), PDF (print), SVG
- **Drag & drop** — drop `.nwk` files onto the page to load them
- **Keyboard shortcuts** — `Ctrl+Enter` to render, `Ctrl+0` to fit to view

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

### Install dependencies

```sh
npm install
```

### Run the development server

```sh
npm run dev
```

This starts Vite's dev server at `http://localhost:5173/newick-viewer/`. Changes to source files are reflected instantly via hot module replacement.

### Build for production

```sh
npm run build
```

Output is written to `dist/`. To preview the production build locally:

```sh
npm run preview
```

This serves the built site at `http://localhost:4173/newick-viewer/`.

## Usage

1. **Paste a Newick string** into the sidebar textarea, or **drag and drop** a `.nwk` / `.tree` / `.txt` file onto the page.
2. Click **Display tree** (or press `Ctrl+Enter`).
3. Use the toolbar to switch between **Rectangular** and **Radial** layouts.
4. Enable **Tanglegram** mode to compare two trees side by side.
5. Adjust display settings in the sidebar (colors, line widths, label sizes, annotation toggles).
6. Click **Copy link** to get a shareable URL that encodes the full visualization state.
7. **Export** the tree as SVG, standalone HTML, or PDF.

### Example Newick strings

Simple tree:
```
((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);
```

Primate phylogeny:
```
((((Homo_sapiens:0.0067,Pan_troglodytes:0.0072):0.0024,
Gorilla_gorilla:0.0089):0.0096,(Pongo_abelii:0.0183,
Hylobates_lar:0.0220):0.0033):0.0350,(Macaca_mulatta:0.0370,
Papio_anubis:0.0365):0.0150);
```

Or click **Load example** in the app to try a built-in demo.

## Running tests

### Unit tests

```sh
npm test
```

Runs 47 tests with [Vitest](https://vitest.dev/) covering the Newick parser, layout engine, and URL state encoding.

### End-to-end tests

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Runs 14 Playwright tests against a production build. The web server is started automatically. Tests cover tree rendering, layout switching, tanglegram mode, URL state persistence, style controls, and error handling.

## Project structure

```
src/
├── main.ts            App entry point, UI construction, event wiring
├── newick-parser.ts   Recursive descent Newick parser
├── layout.ts          Rectangular and radial layout algorithms
├── renderer.ts        D3.js SVG renderer with zoom/pan and scale bar
├── tanglegram.ts      Side-by-side tree comparison renderer
├── state.ts           URL state encoding/decoding (LZ-string)
├── export.ts          SVG, HTML, and PDF export
├── types.ts           TypeScript interfaces and defaults
└── style.css          Global styles

tests/                 Vitest unit tests
e2e/                   Playwright integration tests
.github/workflows/     CI: lint + test on PRs, full e2e + deploy on main
```

## Deployment

The app deploys to GitHub Pages automatically when commits are pushed to `main`. The CI pipeline runs type-checking and unit tests on every PR; full Playwright e2e tests and deployment run only on `main`.

To deploy manually:

```sh
npm run build
# Upload the contents of dist/ to any static hosting
```

The `base` path in `vite.config.ts` is set to `/newick-viewer/`. Change this if deploying to a different path.

## Tech stack

| Concern | Tool |
|---------|------|
| Build | [Vite](https://vitejs.dev/) + TypeScript |
| Rendering | [D3.js](https://d3js.org/) (SVG) |
| URL state | [lz-string](https://github.com/pieroxy/lz-string) |
| Unit tests | [Vitest](https://vitest.dev/) |
| E2E tests | [Playwright](https://playwright.dev/) |
| CI/CD | GitHub Actions → GitHub Pages |
