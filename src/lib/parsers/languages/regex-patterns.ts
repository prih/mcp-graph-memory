/**
 * Built-in regex fallback patterns for languages without tree-sitter WASM grammars.
 * Languages with WASM grammars (Python, Go, Rust, Java, PHP, Ruby, C#, C++, Bash, GDScript)
 * are handled by dedicated tree-sitter mappers instead.
 */
import { createRegexMapper } from './regex-mapper';
import { registerRegexLanguage } from './registry';
import type { ExtractedSymbol, ExtractedImport, RegexLanguageMapper } from './types';

const SLASH_LINE = /^\s*\/\//;
const HASH_LINE = /^\s*#/;
const DASH_LINE = /^\s*--/;

let _registered = false;

/** Register the built-in regex fallback mappers. Idempotent. */
export function registerRegexLanguages(): void {
  if (_registered) return;
  _registered = true;

  // ---- Kotlin ----
  registerRegexLanguage('kotlin', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|protected\s+|inline\s+|suspend\s+|override\s+|open\s+|operator\s+|infix\s+)*fun\s+(?:<[^>]+>\s+)?(?:[\w.]+\.)?(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|protected\s+|abstract\s+|open\s+|sealed\s+|data\s+|inner\s+|annotation\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|protected\s+)*interface\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+)*object\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+(?<specifier>[\w.]+)/m },
    ],
  }));

  // ---- Swift ----
  registerRegexLanguage('swift', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|fileprivate\s+|open\s+|static\s+|final\s+|override\s+|mutating\s+)*func\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|open\s+|final\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|open\s+)*struct\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|open\s+)*protocol\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'enum',      pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|open\s+)*enum\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+(?<specifier>[\w.]+)/m },
    ],
  }));

  // ---- Lua ----
  registerRegexLanguage('lua', createRegexMapper({
    docCommentLine: DASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[ \t]*(?:local\s+)?function\s+(?:[\w.:]+[.:])?(?<name>[A-Za-z_]\w*)/m },
      { kind: 'function', pattern: /^[ \t]*(?:local\s+)?(?<name>[A-Za-z_]\w*)\s*=\s*function/m },
    ],
    imports: [
      { pattern: /\brequire\s*\(?\s*['"](?<specifier>[^'"]+)['"]/m },
    ],
  }));

  // ---- GLSL / shader ----
  const glslMapper = createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[A-Za-z_][\w]*\s+(?<name>[A-Za-z_]\w*)\s*\([^)]*\)\s*\{/m },
      { kind: 'variable', pattern: /^\s*uniform\s+[\w\s]+?(?<name>[A-Za-z_]\w*)\s*[;=]/m },
      { kind: 'type',     pattern: /^[ \t]*struct\s+(?<name>[A-Za-z_]\w*)\s*\{/m },
    ],
    imports: [
      { pattern: /^\s*#\s*include\s*[<"](?<specifier>[^>"]+)[>"]/m },
    ],
  });
  registerRegexLanguage('glsl', glslMapper);

  // ---- Dart ----
  registerRegexLanguage('dart', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'class',     pattern: /^[ \t]*(?:abstract\s+)?class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*mixin\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+['"](?<specifier>[^'"]+)['"]/m },
    ],
  }));

  // ---- SQL ----
  registerRegexLanguage('sql', createRegexMapper({
    docCommentLine: DASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+(?<name>[A-Za-z_][\w.]*)/im },
      { kind: 'type',     pattern: /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|TYPE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?<name>[A-Za-z_][\w.]*)/im },
    ],
    imports: [],
  }));

  // ---- Scala ----
  registerRegexLanguage('scala', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*(?:override\s+|private\s+|protected\s+|public\s+|implicit\s+)*def\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:abstract\s+|sealed\s+|final\s+|case\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:sealed\s+)?trait\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:case\s+)?object\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+(?<specifier>[\w.]+)/m },
    ],
  }));

  // ---- Elixir ----
  registerRegexLanguage('elixir', createRegexMapper({
    docCommentLine: HASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[ \t]*def(?:p)?\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',    pattern: /^[ \t]*defmodule\s+(?<name>[A-Z][\w.]*)/m },
    ],
    imports: [
      { pattern: /^\s*(?:import|alias|use|require)\s+(?<specifier>[A-Z][\w.]*)/m },
    ],
  }));

  // ---- Haskell ----
  registerRegexLanguage('haskell', createRegexMapper({
    docCommentLine: DASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^(?<name>[a-z]\w*)\s*::/m },
      { kind: 'class',     pattern: /^data\s+(?<name>[A-Z]\w*)/m },
      { kind: 'type',      pattern: /^type\s+(?<name>[A-Z]\w*)/m },
      { kind: 'interface', pattern: /^class\s+(?:\([^)]+\)\s+=>\s+)?(?<name>[A-Z]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+(?:qualified\s+)?(?<specifier>[\w.]+)/m },
    ],
  }));

  // ---- Godot Scene (.tscn / .escn) ----
  // Custom mapper: nodes can share names under different parents, so we use
  // the full node path (parent/name) as the unique symbol identifier.
  registerRegexLanguage('godot-scene', ((): RegexLanguageMapper => {
    const NODE_RE    = /^\[node name="([^"]+)"(?:[^\]]*? type="([^"]*)")?(?:[^\]]*? parent="([^"]*)")?\]/gm;
    const SUB_RE     = /^\[sub_resource type="([^"]*)" id="([^"]*)"/gm;
    const CONN_RE    = /^\[connection signal="([^"]+)" from="([^"]+)" to="([^"]+)" method="([^"]+)"/gm;
    const EXT_RE     = /^\[ext_resource [^\]]*path="(res:\/\/[^"]+)"/gm;

    function offsetToLine(src: string, idx: number): number {
      let n = 1;
      for (let i = 0; i < idx && i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
      return n;
    }

    return {
      extractSymbols(source: string) {
        const symbols: ExtractedSymbol[] = [];
        const seen = new Set<string>();

        // Nodes — build full path to avoid duplicate names
        NODE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = NODE_RE.exec(source)) !== null) {
          const nodeName = m[1];
          const parent   = m[3];          // undefined = root, "." = direct child of root

          let fullPath: string;
          if (parent === undefined) {
            fullPath = nodeName;           // root node
          } else if (parent === '.') {
            fullPath = nodeName;
          } else {
            fullPath = `${parent}/${nodeName}`;
          }

          // Disambiguate truly duplicate paths (shouldn't happen in valid tscn)
          let key = fullPath;
          let n = 1;
          while (seen.has(key)) key = `${fullPath}#${++n}`;
          seen.add(key);

          const line = offsetToLine(source, m.index);
          symbols.push({
            name: key,
            kind: parent === undefined ? 'class' : 'variable',
            signature: m[0],
            docComment: '',
            body: m[0],
            startLine: line,
            endLine: line,
            isExported: true,
          });
        }

        // Sub-resources
        SUB_RE.lastIndex = 0;
        while ((m = SUB_RE.exec(source)) !== null) {
          const id   = m[2];
          const type = m[1];
          const key  = `${type}::${id}`;
          const line = offsetToLine(source, m.index);
          symbols.push({
            name: key,
            kind: 'variable',
            signature: m[0],
            docComment: '',
            body: m[0],
            startLine: line,
            endLine: line,
            isExported: false,
          });
        }

        // Connections
        CONN_RE.lastIndex = 0;
        while ((m = CONN_RE.exec(source)) !== null) {
          const signal = m[1];
          const from   = m[2];
          const method = m[4];
          const key    = `${from}.${signal}→${method}`;
          const line   = offsetToLine(source, m.index);
          symbols.push({
            name: key,
            kind: 'variable',
            signature: m[0],
            docComment: '',
            body: m[0],
            startLine: line,
            endLine: line,
            isExported: false,
          });
        }

        symbols.sort((a, b) => a.startLine - b.startLine);
        return symbols;
      },

      extractEdges(_source: string) { return []; },

      extractImports(source: string) {
        const out: ExtractedImport[] = [];
        EXT_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = EXT_RE.exec(source)) !== null) out.push({ specifier: m[1] });
        return out;
      },
    };
  })());

  // ---- Godot Resource (.tres) ----
  registerRegexLanguage('godot-resource', createRegexMapper({
    docCommentLine: /^\s*;/,
    symbols: [
      // Resource type as the main "class"
      { kind: 'class',    pattern: /^\[gd_resource type="(?<name>[^"]+)"/m },
      // Embedded sub-resources
      { kind: 'variable', pattern: /^\[sub_resource type="[^"]*" id="(?<name>[^"]+)"/m },
    ],
    imports: [
      { pattern: /^\[ext_resource [^\]]*path="(?<specifier>res:\/\/[^"]+)"/m },
    ],
  }));

  // ---- Godot Project (project.godot) ----
  registerRegexLanguage('godot-project', createRegexMapper({
    docCommentLine: /^\s*;/,
    symbols: [
      // Config sections like [application], [rendering/environment/defaults]
      { kind: 'variable', pattern: /^\[(?<name>[a-z][a-z0-9_/]*)\]/m },
    ],
    imports: [
      // Main scene and other res:// references
      { pattern: /=\s*"(?<specifier>res:\/\/[^"]+)"/m },
    ],
  }));

  // ---- Godot Extension (.gdextension) ----
  registerRegexLanguage('godot-extension', createRegexMapper({
    docCommentLine: /^\s*;/,
    symbols: [
      // INI sections
      { kind: 'variable', pattern: /^\[(?<name>[a-z][a-z0-9_.]*)\]/m },
    ],
    imports: [
      { pattern: /=\s*"(?<specifier>res:\/\/[^"]+)"/m },
    ],
  }));
}
