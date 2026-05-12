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
  return getPrecedingDoc(node, ['block_comment', 'line_comment'], '/**') ||
    getPrecedingDoc(node, ['line_comment']);
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function isPublic(node: TSNode): boolean {
  const mods = node.childForFieldName('modifiers');
  if (!mods) return false;
  return mods.text?.includes('public') ?? false;
}

function extractClassMembers(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;
  for (const member of body.namedChildren ?? []) {
    switch (member.type) {
      case 'method_declaration': {
        const name = member.childForFieldName('name')?.text ?? '';
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
          isExported: isPublic(member),
        });
        break;
      }
      case 'constructor_declaration': {
        const name = member.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const doc = getDoc(member);
        children.push({
          name,
          kind: 'constructor',
          signature: buildSig(member),
          docComment: doc,
          body: buildBody(member, doc),
          startLine: startLine(member),
          endLine: endLine(member),
          isExported: isPublic(member),
        });
        break;
      }
      case 'field_declaration': {
        const decl = member.childForFieldName('declarator');
        const name = decl?.childForFieldName('name')?.text ?? '';
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
          isExported: isPublic(member),
        });
        break;
      }
    }
  }
  return children;
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
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
        isExported: isPublic(node),
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
        isExported: isPublic(node),
      }];
    }
    case 'enum_declaration': {
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
    case 'annotation_type_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'type',
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

const javaMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    function visit(node: TSNode): void {
      const results = processTopLevel(node);
      if (results.length > 0) {
        symbols.push(...results);
        return; // don't recurse into processed nodes (children already extracted)
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
          const superclass = node.childForFieldName('superclass');
          if (superclass) {
            // superclass node contains 'extends' keyword + type_identifier
            for (const c of superclass.namedChildren ?? []) {
              if (c.type === 'type_identifier') {
                edges.push({ fromName: className, toName: c.text, kind: 'extends' });
              }
            }
          }
          const interfaces = node.childForFieldName('interfaces');
          if (interfaces) {
            for (const c of interfaces.namedChildren ?? []) {
              if (c.type === 'type_identifier') {
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
    for (const child of rootNode.children ?? []) {
      if (child.type === 'import_declaration') {
        // import_declaration: import (static)? name ;
        // name can be scoped_identifier or asterisk
        for (const n of child.namedChildren ?? []) {
          if (n.type === 'scoped_identifier' || n.type === 'identifier') {
            imports.push({ specifier: n.text });
            break;
          }
        }
      }
    }
    return imports;
  },
};

let _registered = false;

export function registerJava(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('java', 'tree-sitter-java.wasm', javaMapper);
}
