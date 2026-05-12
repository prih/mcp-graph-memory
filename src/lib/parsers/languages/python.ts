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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDoc(node: TSNode): string {
  return getPrecedingDoc(node, ['comment'], '#');
}

/** Extract Python docstring from the first statement in a body block. */
function getDocstring(body: TSNode): string {
  if (!body) return '';
  const first = body.namedChildren?.[0];
  if (first?.type === 'expression_statement') {
    const str = first.namedChildren?.[0];
    if (str?.type === 'string') return str.text.trim();
  }
  return '';
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

// ---------------------------------------------------------------------------
// Symbol extraction
// ---------------------------------------------------------------------------

function extractFunctionDef(node: TSNode, doc: string): ExtractedSymbol {
  const name = node.childForFieldName('name')?.text ?? '';
  const body = node.childForFieldName('body');
  const docComment = doc || getDocstring(body);
  return {
    name,
    kind: 'function',
    signature: buildSig(node),
    docComment,
    body: buildBody(node, docComment),
    startLine: startLine(node),
    endLine: endLine(node),
    isExported: true,
  };
}

function extractClassMethods(classBody: TSNode): ExtractedSymbol[] {
  const children: ExtractedSymbol[] = [];
  if (!classBody) return children;
  for (const stmt of classBody.namedChildren ?? []) {
    let defNode = stmt;
    if (stmt.type === 'decorated_definition') {
      defNode = stmt.childForFieldName('definition') ?? stmt;
    }
    if (defNode.type === 'function_definition') {
      const name = defNode.childForFieldName('name')?.text ?? '';
      if (!name) continue;
      const body = defNode.childForFieldName('body');
      const docComment = getDocstring(body);
      children.push({
        name,
        kind: name === '__init__' ? 'constructor' : 'method',
        signature: buildSig(defNode),
        docComment,
        body: buildBody(defNode, docComment),
        startLine: startLine(defNode),
        endLine: endLine(defNode),
        isExported: false,
      });
    }
  }
  return children;
}

function extractClassDef(node: TSNode, doc: string): ExtractedSymbol {
  const name = node.childForFieldName('name')?.text ?? '';
  const body = node.childForFieldName('body');
  const docComment = doc || getDocstring(body);
  const children = extractClassMethods(body);
  return {
    name,
    kind: 'class',
    signature: buildSig(node),
    docComment,
    body: buildBody(node, docComment),
    startLine: startLine(node),
    endLine: endLine(node),
    isExported: true,
    children: children.length > 0 ? children : undefined,
  };
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'function_definition':
      return [extractFunctionDef(node, getDoc(node))];
    case 'class_definition':
      return [extractClassDef(node, getDoc(node))];
    case 'decorated_definition': {
      const inner = node.childForFieldName('definition');
      if (!inner) return [];
      const doc = getDoc(node);
      if (inner.type === 'function_definition') return [extractFunctionDef(inner, doc)];
      if (inner.type === 'class_definition') return [extractClassDef(inner, doc)];
      return [];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

const pythonMapper: LanguageMapper = {
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
      if (node.type === 'class_definition') {
        const className = node.childForFieldName('name')?.text;
        if (className) {
          const superclasses = node.childForFieldName('superclasses');
          if (superclasses) {
            for (const arg of superclasses.namedChildren ?? []) {
              const baseName = arg.type === 'identifier' ? arg.text
                : arg.type === 'attribute' ? arg.childForFieldName('attribute')?.text ?? arg.text
                : null;
              if (baseName && baseName !== 'object') {
                edges.push({ fromName: className, toName: baseName, kind: 'extends' });
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
      if (child.type === 'import_statement') {
        for (const n of child.namedChildren ?? []) {
          const text = n.type === 'dotted_name' ? n.text
            : n.type === 'aliased_import' ? n.childForFieldName('name')?.text
            : null;
          if (text) imports.push({ specifier: text });
        }
      } else if (child.type === 'import_from_statement') {
        const mod = child.childForFieldName('module_name')?.text;
        if (mod) imports.push({ specifier: mod });
      }
    }
    return imports;
  },
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

let _registered = false;

export function registerPython(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('python', 'tree-sitter-python.wasm', pythonMapper);
}
