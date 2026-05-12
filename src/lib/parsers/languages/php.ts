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
  return getPrecedingDoc(node, ['comment'], '/**') ||
    getPrecedingDoc(node, ['comment']);
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function extractClassMembers(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;
  for (const member of body.namedChildren ?? []) {
    if (member.type === 'method_declaration') {
      const name = member.childForFieldName('name')?.text ?? '';
      if (!name) continue;
      const doc = getDoc(member);
      children.push({
        name,
        kind: name === '__construct' ? 'constructor' : 'method',
        signature: buildSig(member),
        docComment: doc,
        body: buildBody(member, doc),
        startLine: startLine(member),
        endLine: endLine(member),
        isExported: false,
      });
    }
  }
  return children;
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'function_definition': {
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
    case 'class_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractClassMembers(body);
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
    case 'interface_declaration': {
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
    case 'trait_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractClassMembers(body);
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
    default:
      return [];
  }
}

const phpMapper: LanguageMapper = {
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
      if (node.type === 'class_declaration') {
        const className = node.childForFieldName('name')?.text;
        if (className) {
          const base = node.childForFieldName('base_clause');
          if (base) {
            for (const c of base.namedChildren ?? []) {
              if (c.type === 'qualified_name' || c.type === 'name') {
                edges.push({ fromName: className, toName: c.text, kind: 'extends' });
              }
            }
          }
          const impl = node.childForFieldName('class_implements');
          if (impl) {
            for (const c of impl.namedChildren ?? []) {
              if (c.type === 'qualified_name' || c.type === 'name') {
                edges.push({ fromName: className, toName: c.text, kind: 'implements' });
              }
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
      if (node.type === 'namespace_use_declaration') {
        for (const clause of node.namedChildren ?? []) {
          if (clause.type === 'namespace_use_clause') {
            const name = clause.namedChildren?.[0];
            if (name) imports.push({ specifier: name.text });
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

export function registerPhp(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('php', 'tree-sitter-php.wasm', phpMapper);
}
