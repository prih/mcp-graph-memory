/**
 * Shared utilities for tree-sitter language mappers.
 */
import { SIGNATURE_MAX_LEN } from '@/lib/defaults';

export type TSNode = any;

export function truncate(text: string, maxLen = SIGNATURE_MAX_LEN): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) + '…' : collapsed;
}

export function startLine(node: TSNode): number {
  return (node.startPosition?.row ?? 0) + 1;
}

export function endLine(node: TSNode): number {
  return (node.endPosition?.row ?? 0) + 1;
}

/**
 * Slice outerNode.text up to where bodyNode begins (line-based to avoid
 * tree-sitter byte-offset vs JS char-offset mismatch).
 */
export function sliceBeforeBody(outerNode: TSNode, bodyNode: TSNode): string | null {
  const text = outerNode.text ?? '';
  const outerStartRow = outerNode.startPosition.row;
  const bodyStartRow = bodyNode.startPosition.row;

  if (bodyStartRow > outerStartRow) {
    const lines = text.split('\n');
    const relativeRow = bodyStartRow - outerStartRow;
    const beforeBody = lines.slice(0, relativeRow);
    const bodyLine = lines[relativeRow] ?? '';
    const col = bodyNode.startPosition.column;
    if (col > 0) beforeBody.push(bodyLine.slice(0, col));
    return beforeBody.join('\n');
  }

  const col = bodyNode.startPosition.column - outerNode.startPosition.column;
  if (col > 0) return text.slice(0, col);
  return null;
}

/** Build signature: everything before body node, or first line fallback. */
export function buildSignature(node: TSNode, bodyFieldName = 'body'): string {
  const bodyNode = node.childForFieldName(bodyFieldName);
  const text = node.text ?? '';
  if (!bodyNode) return truncate(text);
  const header = sliceBeforeBody(node, bodyNode);
  return truncate(header ?? text.split('\n')[0]);
}

export function buildBody(node: TSNode, docComment: string): string {
  if (docComment) return docComment + '\n' + (node.text ?? '');
  return node.text ?? '';
}

/**
 * Find the nearest preceding doc comment.
 * @param nodeTypes  set of comment node types to accept (default: ['comment'])
 * @param prefix     required text prefix (e.g. '/**', '///', '#')
 */
export function getPrecedingDoc(
  node: TSNode,
  nodeTypes: string[] = ['comment'],
  prefix?: string,
): string {
  const types = new Set(nodeTypes);
  let prev = node.previousNamedSibling;

  if (prefix) {
    while (prev && types.has(prev.type) && !prev.text.startsWith(prefix)) {
      prev = prev.previousNamedSibling;
    }
  }

  if (prev && types.has(prev.type) && (!prefix || prev.text.startsWith(prefix))) {
    return prev.text.trim();
  }
  return '';
}

/** Walk named children of a node, calling visitor for each. */
export function walkChildren(node: TSNode, visitor: (child: TSNode) => void): void {
  if (!node) return;
  for (const child of node.namedChildren ?? []) {
    visitor(child);
  }
}
