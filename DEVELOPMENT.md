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

```sh
npm run build
```

Output is written to `dist/`. Preview it locally:

```sh
npm run preview
```

Serves the built site at `http://localhost:4173/newick-viewer/`.

## Testing

### Unit tests

```sh
npm test
```

48 tests covering the Newick parser, layout engine, and URL state encoding. Uses [Vitest](https://vitest.dev/).

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

Playwright tests against a production build. The web server is started automatically. Covers tree rendering, layout switching, tanglegram mode, URL state persistence, style controls, error handling, and auto-sync behavior.

### All scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:api` | OpenTree API integration tests |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |

## Project structure

```
src/
├── main.ts            App entry point, UI construction, event wiring
├── newick-parser.ts   Recursive descent Newick parser + tree editing operations
├── layout.ts          Rectangular and radial layout algorithms
├── renderer.ts        D3.js SVG renderer with zoom/pan, scale bar, context menu
├── tanglegram.ts      Side-by-side tree comparison renderer
├── opentree.ts        Open Tree of Life API client
├── state.ts           URL state encoding/decoding (LZ-string)
├── export.ts          SVG, HTML, and PDF export
├── types.ts           TypeScript interfaces and defaults
└── style.css          Global styles

tests/                 Vitest unit tests
  ├── newick-parser.test.ts
  ├── layout.test.ts
  ├── state.test.ts
  └── opentree.test.ts     (API integration, excluded from default run)

e2e/                   Playwright integration tests
  └── tree-viewer.spec.ts

.github/workflows/     CI configuration
  └── ci.yml
```

## CI/CD

GitHub Actions runs on every push and PR:

| Trigger | Jobs |
|---------|------|
| PR / branch push | `check`: type-check, unit tests, API tests, build |
| Push to main | `check` + `test-e2e` (Playwright) + `deploy` (GitHub Pages) |

## Deployment

The app deploys to GitHub Pages automatically when commits are pushed to `main`.

To deploy manually, build and upload `dist/` to any static hosting. The `base` path in `vite.config.ts` is set to `/newick-viewer/` — change this if deploying to a different path.

## Tech stack

| Concern | Tool |
|---------|------|
| Build | [Vite](https://vitejs.dev/) + TypeScript |
| Rendering | [D3.js](https://d3js.org/) (SVG) |
| URL state | [lz-string](https://github.com/pieroxy/lz-string) |
| Unit tests | [Vitest](https://vitest.dev/) |
| E2E tests | [Playwright](https://playwright.dev/) |
| CI/CD | GitHub Actions → GitHub Pages |

## Architecture notes

**Data flow**: Newick string → `parseNewick()` → `TreeNode` tree → `computeLayout()` → `LayoutResult` (coordinates) → `TreeRenderer` (D3.js SVG).

**State management**: A single `ViewState` object holds all app state (tree data, layout mode, style settings, tanglegram config). It is serialized to the URL hash via LZ-string compression on every change, enabling shareable links.

**Tree editing**: The `TreeNode` is mutated in place by editing operations (flip, prune, reroot, ladderize). After mutation, `toNewick()` serializes back to text and the textarea is updated. A full re-layout and re-render follows.

**Tanglegram connections**: Connection line endpoints are measured via `SVG getBBox()` on the rendered label text, so lines originate from the visual end of each label rather than the tree tip node.
