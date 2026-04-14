import { TreeNode } from './types';

/**
 * Parse a Newick format string into a tree structure.
 *
 * Newick format grammar:
 *   tree     → subtree ";"
 *   subtree  → leaf | internal
 *   leaf     → name
 *   internal → "(" branchset ")" name
 *   branchset→ branch ("," branch)*
 *   branch   → subtree (":" length)?
 *   name     → quoted_string | unquoted_string | empty
 *   length   → number
 */
export function parseNewick(input: string): TreeNode {
  const str = input.trim();
  if (!str) {
    throw new Error('Empty Newick string');
  }

  let pos = 0;
  let nextId = 0;

  function peek(): string {
    skipWhitespace();
    skipAnnotations();
    return str[pos] ?? '';
  }

  function consume(expected?: string): string {
    skipWhitespace();
    skipAnnotations();
    if (pos >= str.length) {
      throw new Error(`Unexpected end of input at position ${pos}`);
    }
    const ch = str[pos];
    if (expected !== undefined && ch !== expected) {
      throw new Error(
        `Expected '${expected}' but got '${ch}' at position ${pos}`
      );
    }
    pos++;
    return ch;
  }

  function skipWhitespace(): void {
    while (pos < str.length && /\s/.test(str[pos])) {
      pos++;
    }
  }

  /** Skip bracket annotations like [&&&NHX:...] or [100] */
  function skipAnnotations(): void {
    skipWhitespace();
    while (pos < str.length && str[pos] === '[') {
      let depth = 1;
      pos++; // skip '['
      while (pos < str.length && depth > 0) {
        if (str[pos] === '[') depth++;
        else if (str[pos] === ']') depth--;
        pos++;
      }
      skipWhitespace();
    }
  }

  function parseTree(): TreeNode {
    const node = parseSubtree();
    // Root can also have a branch length
    if (peek() === ':') {
      consume(':');
      node.branchLength = parseLength();
    }
    // Semicolon is optional at end
    if (peek() === ';') {
      consume(';');
    }
    return node;
  }

  function parseSubtree(): TreeNode {
    const node: TreeNode = { name: '', branchLength: null, children: [], id: nextId++ };

    if (peek() === '(') {
      // Internal node
      consume('(');
      node.children.push(parseBranch());
      while (peek() === ',') {
        consume(',');
        node.children.push(parseBranch());
      }
      consume(')');
    }

    // Node name (for both leaf and internal nodes)
    node.name = parseName();

    return node;
  }

  function parseBranch(): TreeNode {
    const node = parseSubtree();

    // Optional branch length
    if (peek() === ':') {
      consume(':');
      node.branchLength = parseLength();
    }

    return node;
  }

  function parseName(): string {
    skipWhitespace();
    skipAnnotations();
    if (pos >= str.length) return '';

    // Quoted name (single quotes, with '' escape for literal quote)
    if (str[pos] === "'") {
      pos++; // skip opening quote
      let name = '';
      while (pos < str.length) {
        if (str[pos] === "'") {
          // Check for escaped quote ('')
          if (pos + 1 < str.length && str[pos + 1] === "'") {
            name += "'";
            pos += 2;
          } else {
            pos++; // skip closing quote
            break;
          }
        } else {
          name += str[pos];
          pos++;
        }
      }
      skipAnnotations();
      return name;
    }

    // Unquoted name - read until delimiter, skip brackets
    let name = '';
    while (
      pos < str.length &&
      !':,;()[]'.includes(str[pos]) &&
      !/\s/.test(str[pos])
    ) {
      name += str[pos];
      pos++;
    }
    skipAnnotations();
    return name;
  }

  function parseLength(): number {
    skipWhitespace();
    // Use regex to match a proper floating point number from current position
    const remaining = str.slice(pos);
    const match = remaining.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
    if (!match) {
      throw new Error(`Invalid branch length at position ${pos}`);
    }
    pos += match[0].length;
    const val = parseFloat(match[0]);
    if (isNaN(val)) {
      throw new Error(`Invalid branch length '${match[0]}' at position ${pos}`);
    }
    skipAnnotations(); // Skip any annotations after branch length like :0.1[100]
    return val;
  }

  return parseTree();
}

/** Serialize a tree back to Newick format */
export function toNewick(node: TreeNode): string {
  let result = '';
  if (node.children.length > 0) {
    result += '(';
    result += node.children.map((child) => {
      let s = toNewick(child);
      if (child.branchLength !== null) {
        s += ':' + child.branchLength;
      }
      return s;
    }).join(',');
    result += ')';
  }
  // Escape name if it contains special characters
  if (node.name) {
    if (/[,:;()\s'\[\]]/.test(node.name)) {
      // Double any embedded single quotes per Newick convention
      result += "'" + node.name.replace(/'/g, "''") + "'";
    } else {
      result += node.name;
    }
  }
  return result;
}

/** Get all leaf names from a tree */
export function getLeafNames(node: TreeNode): string[] {
  if (node.children.length === 0) {
    return [node.name];
  }
  return node.children.flatMap(getLeafNames);
}

/** Count total nodes in a tree */
export function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/** Get the maximum depth (longest path from root to leaf) */
export function getMaxDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(getMaxDepth));
}

/** Get the total branch length from root to deepest leaf */
export function getMaxBranchLength(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return Math.max(
    ...node.children.map(
      (child) => (child.branchLength ?? 1) + getMaxBranchLength(child)
    )
  );
}

// --- Tree editing operations ---

/** Remove a node from its parent. Promotes the sibling if only one remains. */
export function pruneNode(root: TreeNode, target: TreeNode): TreeNode | null {
  if (root === target) return null; // Can't prune root

  function removeFromParent(parent: TreeNode): boolean {
    const idx = parent.children.indexOf(target);
    if (idx >= 0) {
      parent.children.splice(idx, 1);
      // If parent now has exactly 1 child, merge it into the parent
      if (parent.children.length === 1) {
        const only = parent.children[0];
        // Combine branch lengths
        only.branchLength =
          (parent.branchLength ?? 0) + (only.branchLength ?? 0) || null;
        // Replace parent in grandparent
        replaceInParent(root, parent, only);
      }
      return true;
    }
    return parent.children.some(removeFromParent);
  }

  removeFromParent(root);
  // If root itself was reduced to a single child, promote that child
  if (root.children.length === 1) {
    const only = root.children[0];
    only.branchLength = null; // Root has no branch length
    return only;
  }
  return root;
}

/** Replace `oldNode` with `newNode` in the tree rooted at `root` */
function replaceInParent(root: TreeNode, oldNode: TreeNode, newNode: TreeNode): void {
  function walk(parent: TreeNode): boolean {
    const idx = parent.children.indexOf(oldNode);
    if (idx >= 0) {
      parent.children[idx] = newNode;
      return true;
    }
    return parent.children.some(walk);
  }
  // If oldNode IS the root, we can't replace via parent traversal
  if (root === oldNode) return;
  walk(root);
}

/** Extract a subtree rooted at the given node (deep copy) */
export function extractSubtree(node: TreeNode): TreeNode {
  return JSON.parse(JSON.stringify(node));
}

/** Reroot the tree at the given internal node */
export function rerootAt(root: TreeNode, target: TreeNode): TreeNode {
  if (root === target) return root;

  // Find path from root to target
  const path: TreeNode[] = [];
  function findPath(node: TreeNode): boolean {
    path.push(node);
    if (node === target) return true;
    for (const child of node.children) {
      if (findPath(child)) return true;
    }
    path.pop();
    return false;
  }
  if (!findPath(root)) return root; // target not found

  // Walk the path and reverse parent-child relationships
  for (let i = 0; i < path.length - 1; i++) {
    const parent = path[i];
    const child = path[i + 1];

    // Remove child from parent
    const idx = parent.children.indexOf(child);
    if (idx >= 0) parent.children.splice(idx, 1);

    // Add parent as child of the next node in path
    child.children.push(parent);

    // Swap branch lengths: parent gets child's old branch length
    const tmp = parent.branchLength;
    parent.branchLength = child.branchLength;
    child.branchLength = tmp;
  }

  // New root has no branch length
  target.branchLength = null;

  return target;
}

/** Sort children by descending leaf count (ladderize) */
export function ladderize(node: TreeNode, ascending: boolean = false): void {
  for (const child of node.children) {
    ladderize(child, ascending);
  }
  if (node.children.length > 1) {
    node.children.sort((a, b) => {
      const ca = countLeaves(a);
      const cb = countLeaves(b);
      return ascending ? ca - cb : cb - ca;
    });
  }
}

function countLeaves(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}
