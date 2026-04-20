# Tree Viewer — Claude memory

## Keep the README Python snippet parameter list in sync

`README.md` contains a FAQ section **"Can I build shareable links programmatically?"** with three tables documenting the parameters accepted by the Python link-building snippet:

1. Top-level `ViewState` fields
2. `style` dict keys (`StyleOptions`)
3. `tanglegramStyle` dict keys (`TanglegramStyle`)

Whenever you add, rename, remove, or change the default of a URL-persisted field, update those tables in the same change. The authoritative sources are:

- `src/types.ts` — `ViewState`, `StyleOptions`, `TanglegramStyle` interfaces and the `DEFAULT_STYLE` / `DEFAULT_TANGLEGRAM_STYLE` constants
- `src/state.ts` — `encodeState` / `decodeState` and `defaultViewState()` (confirms a field is actually serialized to the URL)

Runtime-only state that is not round-tripped through the URL does not belong in these tables. If you add a new top-level serialized field (sibling to `metadata`, `layout`, etc.), also extend the sample `make_tree_link` function in the snippet so the example stays usable.
