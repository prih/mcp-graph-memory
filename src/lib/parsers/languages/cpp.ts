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
    getPrecedingDoc(node, ['comment'], '//');
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

/**
 * Extract the function name from a C/C++ function_definition.
 * function_definition.declarator can be:
 *   function_declarator → declarator (identifier | qualified_identifier | destructor_name | ...)
 *   pointer_declarator → declarator (function_declarator → ...)
 *   reference_declarator → ...
 */
function getFunctionName(node: TSNode): string | null {
  function walkDeclarator(d: TSNode): string | null {
    if (!d) return null;
    if (d.type === 'identifier' || d.type === 'field_identifier') return d.text;
    if (d.type === 'qualified_identifier') {
      // last part of A::B::C
      const name = d.childForFieldName('name');
      return name?.text ?? d.text;
    }
    if (d.type === 'destructor_name') return d.text;
    if (d.type === 'operator_name') return d.text;
    if (d.type === 'function_declarator') {
      return walkDeclarator(d.childForFieldName('declarator'));
    }
    if (d.type === 'pointer_declarator' || d.type === 'reference_declarator' ||
        d.type === 'abstract_pointer_declarator') {
      return walkDeclarator(d.childForFieldName('declarator'));
    }
    return null;
  }

  const decl = node.childForFieldName('declarator');
  return walkDeclarator(decl);
}

function extractClassMembers(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;

  for (const member of body.namedChildren ?? []) {
    if (member.type === 'function_definition') {
      const name = getFunctionName(member);
      if (!name) continue;
      const doc = getDoc(member);
      children.push({
        name,
        kind: 'method',
        signature: buildSig(member),
        docComment: doc,
        body: buildBody(member, doc),
        startLine: startLine(member),
        endLine: endLine(member),
        isExported: false,
      });
    } else if (member.type === 'declaration') {
      // Field declaration inside class
      const decl = member.childForFieldName('declarator');
      const name = decl ? getFunctionName(decl) ?? decl.text : null;
      if (!name) continue;
      const doc = getDoc(member);
      children.push({
        name,
        kind: 'variable',
        signature: truncate(member.text ?? ''),
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
      const name = getFunctionName(node);
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
    case 'class_specifier':
    case 'struct_specifier': {
      const nameNode = node.childForFieldName('name');
      const name = nameNode?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractClassMembers(body);
      return [{
        name,
        kind: node.type === 'struct_specifier' ? 'type' : 'class',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: true,
        children: children.length > 0 ? children : undefined,
      }];
    }
    case 'namespace_definition': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const inner: ExtractedSymbol[] = [];
      for (const child of body?.namedChildren ?? []) {
        inner.push(...processTopLevel(child));
      }
      return [{
        name,
        kind: 'interface',
        signature: truncate(node.text?.split('\n')[0] ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: true,
        children: inner.length > 0 ? inner : undefined,
      }];
    }
    case 'template_declaration': {
      // template<...> wraps a function or class — unwrap and process
      for (const child of node.namedChildren ?? []) {
        const results = processTopLevel(child);
        if (results.length > 0) return results;
      }
      return [];
    }
    case 'enum_specifier': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'enum',
        signature: truncate(node.text?.split('\n')[0] ?? ''),
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

const cppMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    function visit(node: TSNode): void {
      const results = processTopLevel(node);
      if (results.length > 0) {
        symbols.push(...results);
        return;
      }
      // Recurse into declaration nodes (e.g. typedef struct)
      if (node.type === 'declaration' || node.type === 'type_definition') {
        for (const child of node.namedChildren ?? []) {
          symbols.push(...processTopLevel(child));
        }
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
      if (node.type === 'class_specifier') {
        const className = node.childForFieldName('name')?.text;
        if (className) {
          const baseClause = node.childForFieldName('base_class_clause');
          if (baseClause) {
            for (const base of baseClause.namedChildren ?? []) {
              if (base.type === 'type_identifier' || base.type === 'qualified_identifier') {
                edges.push({ fromName: className, toName: base.text, kind: 'extends' });
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
      if (node.type === 'preproc_include') {
        const path = node.childForFieldName('path');
        if (path) {
          const specifier = path.text.replace(/^["<]|[">]$/g, '');
          imports.push({ specifier });
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return imports;
  },
};

let _registered = false;

export function registerCpp(): void {
  if (_registered) return;
  _registered = true;
  // cpp WASM handles both C and C++ (C++ is a superset of C)
  registerLanguage('cpp', 'tree-sitter-cpp.wasm', cppMapper);
  registerLanguage('c', 'tree-sitter-cpp.wasm', cppMapper);
}
