# Newick Viewer

A free, browser-based tool for visualizing phylogenetic trees from Newick files. No installation, no sign-up, no server — paste your data or drag a file and see your tree instantly.

Designed for biologists, bioinformaticians, and biomedical researchers who need to quickly inspect, compare, and share phylogenetic trees.

## What is a phylogenetic tree?

A phylogenetic tree is a branching diagram that shows the evolutionary relationships among species or sequences. The **Newick format** is the most common text representation: nested parentheses encode the tree topology, with optional branch lengths and labels. Example: `((Human:0.1,Chimp:0.1):0.3,Gorilla:0.4);`

---

## Frequently asked questions

### How do I view a Newick tree?

Paste your Newick string into the text box on the left side of the page. The tree renders automatically as you type. You can also **drag and drop** a `.nwk`, `.tree`, or `.txt` file anywhere on the page.

### What Newick features are supported?

The parser handles the full Newick specification:

- Branch lengths (including scientific notation like `1.5e-3`)
- Quoted labels with special characters (`'Homo sapiens'`)
- Internal node labels and bootstrap values
- NHX annotations (`[&&NHX:...]`)
- Bracket comments (including nested)
- Multifurcating nodes and single-leaf trees

### What layout options are available?

- **Rectangular (dendrogram)**: The standard layout with right-angle elbow connectors and an auto-sizing scale bar showing substitutions per site.
- **Radial (circular)**: A polar layout that fits more taxa into less space, with labels rotated to follow the circumference.

Switch between layouts using the toolbar buttons. Species names display in italic with underscores converted to spaces.

### Can I compare two trees side by side?

Yes. Click **Tanglegram** in the toolbar. Two input boxes appear for your two Newick trees. Matching leaf names are connected by curved lines across the gap. You can control:

- **Tree spacing**: How much gap between the two trees
- **Connection color**: Single color or multi-color mode
- **Connection width**: Line thickness
- **Line style**: Solid, dashed, or dotted

### Can I edit the tree interactively?

Yes. The tree and the text box stay in sync — edits in either direction are reflected immediately.

**Left-click** an internal node to flip the order of its children.

**Right-click** any node to open a context menu with:

- **Flip children**: Reverse child order at this node
- **Ladderize (large first / small first)**: Sort the subtree by descending or ascending leaf count
- **Remove node**: Prune this taxon or clade from the tree
- **Keep only this clade**: Extract this subtree, discarding everything else
- **Reroot here**: Reroot the tree at this node

All edits update the Newick text in the sidebar so you can copy the modified tree.

### Can I search for trees from a database?

Yes. The **Open Tree of Life** panel in the sidebar lets you search the [Open Tree of Life](https://opentreeoflife.github.io/) taxonomy and load published phylogenies directly:

- **Subtree mode**: Search for a clade (e.g., "Mammalia") and load its subtree at a configurable depth
- **Induced tree mode**: Select multiple taxa by name and get the tree that relates them

Results are autocompleted as you type.

### How do I share a tree with someone?

Click **Copy link** in the toolbar. The URL encodes the complete visualization state — tree data, layout mode, all display settings, and tanglegram configuration — compressed into the URL hash. Anyone who opens the link sees the exact same view. No server, no database, no account required.

### What export formats are available?

- **SVG**: Vector graphics file, editable in Illustrator or Inkscape
- **HTML**: A standalone interactive page with zoom and pan, viewable in any browser without a server
- **PDF**: Opens the browser print dialog for saving or printing (landscape orientation, publication-ready)

### How do I customize the appearance?

The **Display Settings** panel in the sidebar provides:

- **Branch color** and **width**
- **Label size** and **color**
- **Show branch lengths**: Toggle numeric branch length annotations along branches
- **Show internal labels**: Toggle bootstrap values or clade names at internal nodes

Changes apply instantly. All settings are preserved in shareable URLs.

### Does it work offline?

Yes. Once the page is loaded, everything runs in your browser. The only feature that requires network access is the Open Tree of Life search.

### What are the keyboard shortcuts?

| Shortcut | Action |
|----------|--------|
| Scroll wheel | Zoom in/out |
| Click + drag | Pan |
| `Ctrl+Enter` | Re-render from textarea |
| `Ctrl+0` | Fit tree to view |

The viewer also has +/&minus;/Fit buttons in the bottom-right corner.

### How large of a tree can it handle?

The viewer renders trees with hundreds of taxa comfortably. For very large trees (1000+ leaves), the rectangular layout auto-scales the canvas height and provides fit-to-view. Performance depends on your browser and screen size.

### Is my data private?

Yes. Your tree data never leaves your browser. There is no server, no analytics, no tracking. The shareable URL contains the data itself (compressed), not a reference to a stored copy.

---

## Who is this for?

- **Bench biologists** who receive tree files from collaborators and need a quick way to view them
- **Bioinformaticians** who want to inspect pipeline output without installing desktop software
- **Students and educators** learning about phylogenetics and evolutionary relationships
- **Reviewers** checking supplementary tree figures in manuscripts
- **Anyone** who needs to share a tree visualization via a URL

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for build instructions, project structure, testing, and deployment details.
