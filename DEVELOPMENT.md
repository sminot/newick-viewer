# Development Guide

Technical documentation for building, testing, and deploying the Newick Viewer.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (included with Node.js)

## Setup

```sh
git clone https://github.com/sminot/newick-viewer.git
cd newick-viewer
npm install
```

## Development server

```sh
npm run dev
```

Starts Vite's dev server at `http://localhost:5173/newick-viewer/` with hot module replacement.

## Production build

### Standalone app (GitHub Pages)

```sh
npm run build
```

Output is written to `dist/`. Preview it locally:

```sh
npm run preview
```

### Cirro embedded tool

```sh
npm run build:cirro
```

Output is written to `dist-cirro/`. This builds the viewer as an iframe app for the [Cirro data platform](https://cirro.bio) using `@cirrobio/react-tool`. To develop locally:

```sh
npm run dev:cirro
```

## Testing

### Unit tests

```sh
npm test
```

84 tests covering the Newick parser, NEXUS extraction, tree editing operations, layout engine, URL state encoding, and CSV metadata parsing. Uses [Vitest](https://vitest.dev/).

### Open Tree of Life API tests

```sh
npm run test:api
```

9 integration tests that call the real OpenTree API. Requires network access. Runs on a separate Vitest config (`vitest.api.config.ts`).

### End-to-end tests

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

15 Playwright tests against a production build. The web server is started automatically. Covers tree rendering, layout switching, tanglegram mode, URL state persistence, style controls, error handling, and auto-sync behavior.

### All scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with HMR |
| `npm run dev:cirro` | Cirro embedded tool dev server |
| `npm run build` | Production build to `dist/` |
| `npm run build:cirro` | Cirro embedded tool build to `dist-cirro/` |
| `npm run preview` | Preview production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:api` | OpenTree API integration tests |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |

## Project structure

```
src/
├── main.ts            App entry point, UI construction, event wiring
├── newick-parser.ts   Newick/NEXUS parser + tree editing operations
├── layout.ts          Rectangular and radial layout algorithms
├── renderer.ts        D3.js SVG renderer with zoom/pan, scale bar, context menu, search
├── tanglegram.ts      Side-by-side tree comparison renderer
├── opentree.ts        Open Tree of Life API client
├── metadata.ts        CSV/TSV parser and tip color mapping
├── state.ts           URL state encoding/decoding (LZ-string)
├── export.ts          SVG, HTML, and PDF export
├── types.ts           TypeScript interfaces and defaults
├── style.css          Global styles
└── cirro/             Cirro embedded tool (React)
    ├── App.tsx            ViewerProvider wrapper
    ├── CirroTreeViewer.tsx  React component using Cirro hooks
    ├── core-viewer.ts     Extracted core rendering logic
    └── main.tsx           React entry point

tests/                 Vitest unit tests
  ├── newick-parser.test.ts
  ├── tree-editing.test.ts
  ├── layout.test.ts
  ├── state.test.ts
  ├── metadata.test.ts
  └── opentree.test.ts     (API integration, excluded from default run)

e2e/                   Playwright integration tests
  └── tree-viewer.spec.ts

.github/workflows/     CI configuration
  ├── ci.yml               Build, test, deploy to GitHub Pages
  ├── codeql.yml            CodeQL static security analysis
  ├── preview.yml           PR preview deployments
  └── preview-cleanup.yml   Remove PR previews on close
```

## CI/CD

GitHub Actions workflows:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| **CI & Deploy** | Push / PR | Type-check, unit tests, API tests, npm audit, build. Playwright e2e on PRs and main. Deploy to GitHub Pages on main. |
| **PR Preview** | PR push | Builds and deploys a preview to `pr-preview/pr-{N}/` on `gh-pages`, posts the URL as a PR comment. |
| **PR Preview Cleanup** | PR close | Removes the preview directory from `gh-pages`. |
| **CodeQL** | Push / PR / weekly | Static security analysis for JavaScript/TypeScript. |

## Deployment

The app deploys to GitHub Pages automatically when commits are pushed to `main`. GitHub Pages should be configured to deploy from the `gh-pages` branch (Settings > Pages > Source: "Deploy from a branch" > `gh-pages`).

PR preview URLs are posted as comments on each pull request for inspection before merging.

To deploy manually, build and upload `dist/` to any static hosting. The `base` path in `vite.config.ts` is set to `/newick-viewer/` — change this if deploying to a different path.

## Cirro integration

The viewer can be deployed as an embedded tool inside the [Cirro data platform](https://cirro.bio). The Cirro build wraps the core D3 renderer in a React component that uses Cirro's hooks (`useViewerState`, `useViewerServices`) to discover and load Newick files from a dataset.

To build and deploy:

1. `npm run build:cirro` — outputs to `dist-cirro/`
2. Register the app in your Cirro tenant
3. Upload the contents of `dist-cirro/`

The Cirro viewer auto-discovers `.nwk`/`.newick`/`.tree`/`.nex`/`.nexus` files in the dataset and provides dropdowns for file and metadata selection. Authentication and file access are handled by the Cirro platform.

## Tech stack

| Concern | Tool |
|---------|------|
| Build | [Vite](https://vitejs.dev/) + TypeScript |
| Rendering | [D3.js](https://d3js.org/) (SVG) |
| URL state | [lz-string](https://github.com/pieroxy/lz-string) |
| Cirro integration | [React](https://react.dev/) + [@cirrobio/react-tool](https://github.com/CirroBio/Cirro-client-ts) |
| Unit tests | [Vitest](https://vitest.dev/) |
| E2E tests | [Playwright](https://playwright.dev/) |
| CI/CD | GitHub Actions → GitHub Pages |

## Architecture notes

**Data flow**: Newick/NEXUS string → `parseTreeInput()` → `TreeNode` tree → `computeLayout()` → `LayoutResult` (coordinates) → `TreeRenderer` (D3.js SVG).

**Auto-sync**: The textarea and the tree visualization are bidirectionally synced. Typing in the textarea triggers a debounced re-parse and re-render. Editing the tree via the context menu serializes the modified tree back to Newick and updates the textarea.

**State management**: A single `ViewState` object holds all app state (tree data, layout mode, style settings, tanglegram config). It is serialized to the URL hash via LZ-string compression on every change, enabling shareable links. Metadata (CSV tip coloring) is runtime-only and not persisted in the URL.

**Tree editing**: The `TreeNode` is mutated in place by editing operations (flip, prune, reroot, ladderize). After mutation, `toNewick()` serializes back to text and the textarea is updated. A full re-layout and re-render follows. An undo/redo stack (50 levels) tracks Newick string snapshots before each mutation.

**Tanglegram connections**: Connection line endpoints are measured via `SVG getBBox()` on the rendered label text, so lines originate from the visual end of each label rather than the tree tip node.
