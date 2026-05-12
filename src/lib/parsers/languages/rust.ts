import type { ExtractedSymbol, ExtractedEdge, ExtractedImport, LanguageMapper } from './types';
import { registerLanguage } from './registry';
import {
  type TSNode,
  truncate,
  startLine,
  endLine,
  sliceBeforeBody,
  buildBody,
  getPrecedingDoc,
} from './helpers';

function getDoc(node: TSNode): string {
  // Rust uses `///` doc comments (line_comment) or `/** */` (block_comment)
  return getPrecedingDoc(node, ['line_comment', 'block_comment'], '///') ||
    getPrecedingDoc(node, ['block_comment'], '/**');
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function isPublic(node: TSNode): boolean {
  for (const child of node.children ?? []) {
    if (child.type === 'visibility_modifier') return true;
  }
  return false;
}

function extractImplMethods(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;
  for (const item of body.namedChildren ?? []) {
    if (item.type === 'function_item') {
      const name = item.childForFieldName('name')?.text ?? '';
      if (!name) continue;
      const doc = getDoc(item);
      children.push({
        name,
        kind: 'method',
        signature: buildSig(item),
        docComment: doc,
        body: buildBody(item, doc),
        startLine: startLine(item),
        endLine: endLine(item),
        isExported: isPublic(item),
      });
    }
  }
  return children;
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'function_item': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'function',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
      }];
    }
    case 'struct_item': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'class',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
      }];
    }
    case 'enum_item': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'enum',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
      }];
    }
    case 'trait_item': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'interface',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
      }];
    }
    case 'impl_item': {
      // impl Trait for Type or impl Type — extract methods as children of the type
      const typeNode = node.childForFieldName('type');
      const traitNode = node.childForFieldName('trait');
      const typeName = typeNode?.text ?? '';
      if (!typeName) return [];
      const body = node.childForFieldName('body');
      const children = extractImplMethods(body);
      const doc = getDoc(node);
      const implName = traitNode ? `${typeName}::${traitNode.text}` : typeName;
      return [{
        name: implName,
        kind: 'class',
        signature: truncate(node.text?.split('\n')[0] ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: false,
        children: children.length > 0 ? children : undefined,
      }];
    }
    case 'mod_item': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'interface',
        signature: truncate(node.text?.split('\n')[0] ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
      }];
    }
    default:
      return [];
  }
}

const rustMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    for (const child of rootNode.children ?? []) {
      symbols.push(...processTopLevel(child));
    }
    return symbols;
  },

  extractEdges(rootNode: TSNode): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];

    function visit(node: TSNode): void {
      if (node.type === 'impl_item') {
        const typeNode = node.childForFieldName('type');
        const traitNode = node.childForFieldName('trait');
        if (typeNode && traitNode) {
          edges.push({
            fromName: typeNode.text ?? '',
            toName: traitNode.text ?? '',
            kind: 'implements',
          });
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return edges;
  },

  extractImports(rootNode: TSNode): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function collectUse(node: TSNode): void {
      if (node.type === 'use_declaration') {
        const arg = node.childForFieldName('argument');
        if (arg) {
          // Get the root crate/path from use tree
          const text = arg.text ?? '';
          const top = text.split('::')[0].replace(/[^A-Za-z0-9_]/g, '');
          if (top) imports.push({ specifier: top });
        }
      }
      for (const child of node.children ?? []) collectUse(child);
    }

    collectUse(rootNode);
    return imports;
  },
};

let _registered = false;

export function registerRust(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('rust', 'tree-sitter-rust.wasm', rustMapper);
}
