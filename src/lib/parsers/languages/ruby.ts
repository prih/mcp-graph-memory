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
  return getPrecedingDoc(node, ['comment'], '#');
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function extractBodyMethods(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;
  for (const stmt of body.namedChildren ?? []) {
    if (stmt.type === 'method') {
      const name = stmt.childForFieldName('name')?.text ?? '';
      if (!name) continue;
      const doc = getDoc(stmt);
      children.push({
        name,
        kind: name === 'initialize' ? 'constructor' : 'method',
        signature: buildSig(stmt),
        docComment: doc,
        body: buildBody(stmt, doc),
        startLine: startLine(stmt),
        endLine: endLine(stmt),
        isExported: false,
      });
    }
  }
  return children;
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'method': {
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
        isExported: /^[a-z]/.test(name),
      }];
    }
    case 'singleton_method': {
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
        isExported: true,
      }];
    }
    case 'class': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractBodyMethods(body);
      return [{
        name,
        kind: 'class',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: true,
        children: children.length > 0 ? children : undefined,
      }];
    }
    case 'module': {
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
        isExported: true,
      }];
    }
    default:
      return [];
  }
}

const rubyMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    function visit(node: TSNode): void {
      const results = processTopLevel(node);
      if (results.length > 0) {
        symbols.push(...results);
        return;
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return symbols;
  },

  extractEdges(rootNode: TSNode): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];

    function visit(node: TSNode): void {
      if (node.type === 'class') {
        const className = node.childForFieldName('name')?.text;
        const superclass = node.childForFieldName('superclass');
        if (className && superclass) {
          // superclass node: < constant
          for (const c of superclass.namedChildren ?? []) {
            if (c.type === 'constant' || c.type === 'scope_resolution') {
              edges.push({ fromName: className, toName: c.text, kind: 'extends' });
              break;
            }
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return edges;
  },

  extractImports(rootNode: TSNode): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function visit(node: TSNode): void {
      // require 'foo' or require_relative 'foo' → call nodes
      if (node.type === 'call') {
        const method = node.childForFieldName('method');
        if (method?.text === 'require' || method?.text === 'require_relative') {
          const args = node.childForFieldName('arguments');
          if (args) {
            for (const arg of args.namedChildren ?? []) {
              if (arg.type === 'string') {
                const specifier = arg.text.replace(/^['"]|['"]$/g, '');
                imports.push({ specifier });
              }
            }
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return imports;
  },
};

let _registered = false;

export function registerRuby(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('ruby', 'tree-sitter-ruby.wasm', rubyMapper);
}
