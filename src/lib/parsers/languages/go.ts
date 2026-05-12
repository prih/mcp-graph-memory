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
  return getPrecedingDoc(node, ['comment']);
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function extractMethods(body: TSNode): ExtractedSymbol[] {
  // Go structs don't have methods inside body — methods are top-level with receiver.
  // We extract struct fields as children instead.
  const children: ExtractedSymbol[] = [];
  if (!body) return children;
  // field_declaration_list → field_declaration
  for (const child of body.namedChildren ?? []) {
    if (child.type === 'field_declaration') {
      // field has named children: names (field_identifier) and type
      for (const n of child.namedChildren ?? []) {
        if (n.type === 'field_identifier') {
          children.push({
            name: n.text ?? '',
            kind: 'variable',
            signature: truncate(child.text ?? ''),
            docComment: '',
            body: child.text ?? '',
            startLine: startLine(child),
            endLine: endLine(child),
            isExported: false,
          });
        }
      }
    }
  }
  return children;
}

function processTopLevel(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'function_declaration': {
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
        isExported: /^[A-Z]/.test(name),
      }];
    }
    case 'method_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      return [{
        name,
        kind: 'method',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: /^[A-Z]/.test(name),
      }];
    }
    case 'type_declaration': {
      const symbols: ExtractedSymbol[] = [];
      for (const spec of node.namedChildren ?? []) {
        if (spec.type !== 'type_spec') continue;
        const name = spec.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const typeNode = spec.childForFieldName('type');
        const kind = typeNode?.type === 'struct_type' ? 'class'
          : typeNode?.type === 'interface_type' ? 'interface'
          : 'type';
        const doc = getDoc(node);
        const children = kind === 'class' ? extractMethods(typeNode) : undefined;
        symbols.push({
          name,
          kind,
          signature: truncate(node.text ?? ''),
          docComment: doc,
          body: buildBody(node, doc),
          startLine: startLine(node),
          endLine: endLine(node),
          isExported: /^[A-Z]/.test(name),
          children: children && children.length > 0 ? children : undefined,
        });
      }
      return symbols;
    }
    default:
      return [];
  }
}

const goMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];
    for (const child of rootNode.children ?? []) {
      symbols.push(...processTopLevel(child));
    }
    return symbols;
  },

  extractEdges(_rootNode: TSNode): ExtractedEdge[] {
    // Go uses embedding, not traditional inheritance — skip edges
    return [];
  },

  extractImports(rootNode: TSNode): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function collectSpecs(node: TSNode): void {
      if (node.type === 'import_spec') {
        const path = node.childForFieldName('path');
        if (path) {
          const specifier = path.text.replace(/^["'`]|["'`]$/g, '');
          imports.push({ specifier });
        }
      }
      for (const child of node.namedChildren ?? []) collectSpecs(child);
    }

    for (const child of rootNode.children ?? []) {
      if (child.type === 'import_declaration') collectSpecs(child);
    }
    return imports;
  },
};

let _registered = false;

export function registerGo(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('go', 'tree-sitter-go.wasm', goMapper);
}
