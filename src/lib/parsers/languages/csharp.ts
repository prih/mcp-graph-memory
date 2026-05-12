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
  // C# uses /// single-line doc comments or /** */ block comments
  return getPrecedingDoc(node, ['single_line_doc_comment'], '///') ||
    getPrecedingDoc(node, ['multiline_comment'], '/**') ||
    getPrecedingDoc(node, ['single_line_comment']);
}

function buildSig(node: TSNode): string {
  const body = node.childForFieldName('body');
  if (!body) return truncate(node.text ?? '');
  const header = sliceBeforeBody(node, body);
  return truncate(header ?? (node.text ?? '').split('\n')[0]);
}

function hasModifier(node: TSNode, mod: string): boolean {
  for (const child of node.children ?? []) {
    if (child.type === 'modifier' && child.text === mod) return true;
  }
  return false;
}

function isPublic(node: TSNode): boolean {
  return hasModifier(node, 'public');
}

function extractTypeMembers(body: TSNode): ExtractedSymbol[] {
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
        // field_declaration has variable_declarator children
        for (const decl of member.namedChildren ?? []) {
          if (decl.type === 'variable_declarator') {
            const name = decl.childForFieldName('name')?.text ?? '';
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
          }
        }
        break;
      }
      case 'property_declaration': {
        const name = member.childForFieldName('name')?.text ?? '';
        if (!name) continue;
        const doc = getDoc(member);
        children.push({
          name,
          kind: 'variable',
          signature: truncate(member.text?.split('\n')[0] ?? ''),
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

function processDeclaration(node: TSNode): ExtractedSymbol[] {
  switch (node.type) {
    case 'class_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractTypeMembers(body);
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
    case 'struct_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      const children = extractTypeMembers(body);
      return [{
        name,
        kind: 'type',
        signature: buildSig(node),
        docComment: doc,
        body: buildBody(node, doc),
        startLine: startLine(node),
        endLine: endLine(node),
        isExported: isPublic(node),
        children: children.length > 0 ? children : undefined,
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
    case 'method_declaration': {
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
    case 'namespace_declaration': {
      const name = node.childForFieldName('name')?.text ?? '';
      if (!name) return [];
      const doc = getDoc(node);
      const body = node.childForFieldName('body');
      // Recurse into namespace body
      const inner: ExtractedSymbol[] = [];
      for (const child of body?.namedChildren ?? []) {
        inner.push(...processDeclaration(child));
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
    default:
      return [];
  }
}

const csharpMapper: LanguageMapper = {
  extractSymbols(rootNode: TSNode): ExtractedSymbol[] {
    const symbols: ExtractedSymbol[] = [];

    function visit(node: TSNode): void {
      const results = processDeclaration(node);
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
      if (node.type === 'class_declaration' || node.type === 'struct_declaration') {
        const typeName = node.childForFieldName('name')?.text;
        if (typeName) {
          const baseList = node.childForFieldName('bases');
          if (baseList) {
            for (const base of baseList.namedChildren ?? []) {
              const baseName = base.type === 'identifier' ? base.text
                : base.childForFieldName('name')?.text ?? base.text;
              if (baseName) {
                edges.push({ fromName: typeName, toName: baseName, kind: 'extends' });
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
      if (node.type === 'using_directive') {
        // using_directive: using (static)? name ;
        for (const child of node.namedChildren ?? []) {
          if (child.type === 'identifier' || child.type === 'qualified_name' ||
              child.type === 'alias_qualified_name') {
            imports.push({ specifier: child.text });
            break;
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

export function registerCsharp(): void {
  if (_registered) return;
  _registered = true;
  registerLanguage('csharp', 'tree-sitter-c-sharp.wasm', csharpMapper);
}
