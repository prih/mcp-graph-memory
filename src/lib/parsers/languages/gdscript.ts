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

/** Extract the base class name from extends_statement. */
function getExtendsName(node: TSNode): string | null {
  const ext = node.childForFieldName('extends');
  if (!ext) return null;
  // extends_statement children: type or string
  for (const c of ext.namedChildren ?? []) {
    if (c.type === 'type' || c.type === 'string' || c.type === 'identifier') {
      return c.text.replace(/^["']|["']$/g, '');
    }
  }
  return ext.text.replace(/^["']|["']$/g, '') || null;
}

function extractClassMembers(body: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!body) return children;

  for (const stmt of body.namedChildren ?? []) {
    switch (stmt.type) {
      case 'function_definition': {
        const name = stmt.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const doc = getDoc(stmt);
        children.push({
          name,
          kind: 'method',
          signature: buildSig(stmt),
          docComment: doc,
          body: buildBody(stmt, doc),
          startLine: startLine(stmt),
          endLine: endLine(stmt),
          isExported: !name.startsWith('_'),
        });
        break;
      }
      case 'constructor_definition': {
        const doc = getDoc(stmt);
        children.push({
          name: '_init',
          kind: 'constructor',
          signature: buildSig(stmt),
          docComment: doc,
          body: buildBody(stmt, doc),
          startLine: startLine(stmt),
          endLine: endLine(stmt),
          isExported: false,
        });
        break;
      }
      case 'variable_statement':
      case 'export_variable_statement': {
        const name = stmt.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const doc = getDoc(stmt);
        children.push({
          name,
          kind: 'variable',
          signature: truncate(stmt.text ?? ''),
          docComment: doc,
          body: buildBody(stmt, doc),
          startLine: startLine(stmt),
          endLine: endLine(stmt),
          isExported: stmt.type === 'export_variable_statement',
        });
        break;
      }
      case 'signal_statement': {
        const name = stmt.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const doc = getDoc(stmt);
        children.push({
          name,
          kind: 'variable',
          signature: truncate(stmt.text ?? ''),
          docComment: doc,
          body: buildBody(stmt, doc),
          startLine: startLine(stmt),
          endLine: endLine(stmt),
          isExported: true,
        });
        break;
      }
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
        isExported: !name.startsWith('_'),
      }];
    }
    case 'constructor_definition': {
      const doc = getDoc(node);
      return [{
        name: '_init',
        kind: 'function',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: false,
      }];
    }
    case 'class_definition': {
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
    case 'class_name_statement': {
      // class_name MyClass [extends Base] — top-level class declaration
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'class',
        signature: truncate(node.text ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: true,
      }];
    }
    case 'enum_definition': {
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
    case 'signal_statement': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'variable',
        signature: truncate(node.text ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: true,
      }];
    }
    case 'variable_statement':
    case 'export_variable_statement': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'variable',
        signature: truncate(node.text ?? ''),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: node.type === 'export_variable_statement',
      }];
    }
    case 'const_statement': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'variable',
        signature: truncate(node.text ?? ''),
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

const gdscriptMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    for (const child of rootNode.children ?? []) {
      symbols.push(...processTopLevel(child));
    }
    return symbols;
  },

  extractEdges(rootNode: TSNode): ExtractedEdge[] {
    const edges: ExtractedEdge[] = [];

    // class_name_statement extends Base → file-level inheritance
    for (const child of rootNode.children ?? []) {
      if (child.type === 'class_name_statement') {
        const className = child.childForFieldName('name')?.text;
        const baseName = getExtendsName(child);
        if (className && baseName) {
          edges.push({ fromName: className, toName: baseName, kind: 'extends' });
        }
      }
      if (child.type === 'class_definition') {
        const className = child.childForFieldName('name')?.text;
        const baseName = getExtendsName(child);
        if (className && baseName) {
          edges.push({ fromName: className, toName: baseName, kind: 'extends' });
        }
      }
    }

    return edges;
  },

  extractImports(rootNode: TSNode): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function visit(node: TSNode): void {
      // preload("res://foo.gd") or load("res://foo.gd")
      if (node.type === 'call') {
        const fn = node.namedChildren?.[0];
        if (fn?.type === 'identifier' && (fn.text === 'preload' || fn.text === 'load')) {
          const args = node.childForFieldName('arguments');
          if (args) {
            for (const arg of args.namedChildren ?? []) {
              if (arg.type === 'string') {
                const specifier = arg.text.replace(/^["']|["']$/g, '');
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

export function registerGdscript(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('gdscript', 'tree-sitter-gdscript.wasm', gdscriptMapper);
}
