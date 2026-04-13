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
