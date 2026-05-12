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

const bashMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    function visit(node: TSNode): void {
      if (node.type === 'function_definition') {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text ?? '';
        if (name) {
          const doc = getDoc(node);
          symbols.push({
            name,
            kind: 'function',
            signature: buildSig(node),
            docComment: doc,
            body: buildBody(node, doc),
            startLine: startLine(node),
            endLine: endLine(node),
            isExported: !name.startsWith('_'),
          });
          return; // don't recurse into function body
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return symbols;
  },

  extractEdges(_rootNode: TSNode): ExtractedEdge[] {
    return [];
  },

  extractImports(rootNode: TSNode): ExtractedImport[] {
    const imports: ExtractedImport[] = [];

    function visit(node: TSNode): void {
      // source ./foo or . ./foo
      if (node.type === 'command') {
        const nameNode = node.childForFieldName('name');
        if (nameNode?.text === 'source' || nameNode?.text === '.') {
          const args = node.childForFieldName('argument');
          const arg = args ?? node.namedChildren?.find((c: TSNode) => c.type === 'word');
          if (arg) imports.push({ specifier: arg.text });
        }
      }
      for (const child of node.children ?? []) visit(child);
    }

    visit(rootNode);
    return imports;
  },
};

let _registered = false;

export function registerBash(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('shell', 'tree-sitter-bash.wasm', bashMapper);
  registerLanguage('bash', 'tree-sitter-bash.wasm', bashMapper);
}
