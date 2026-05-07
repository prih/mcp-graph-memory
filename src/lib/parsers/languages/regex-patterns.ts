/**
 * Built-in regex fallback patterns for languages without tree-sitter support.
 * Patterns are best-effort — they don't model every edge case, but they
 * extract enough symbols for code search to be useful.
 */
import { createRegexMapper } from './regex-mapper';
import { registerRegexLanguage } from './registry';

const HASH_LINE = /^\s*#/;
const SLASH_LINE = /^\s*\/\//;
const DASH_LINE = /^\s*--/;

let _registered = false;

/** Register the built-in regex fallback mappers. Idempotent. */
export function registerRegexLanguages(): void {
  if (_registered) return;
  _registered = true;

  // ---- Python ----
  registerRegexLanguage('python', createRegexMapper({
    docCommentLine: HASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[ \t]*(?:async\s+)?def\s+(?<name>[A-Za-z_]\w*)\s*\(/m },
      { kind: 'class',    pattern: /^[ \t]*class\s+(?<name>[A-Za-z_]\w*)\b/m },
    ],
    imports: [
      { pattern: /^\s*from\s+(?<specifier>[\w.]+)\s+import\b/m },
      { pattern: /^\s*import\s+(?<specifier>[\w.]+)/m },
    ],
  }));

  // ---- Go ----
  registerRegexLanguage('go', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^func\s+(?:\([^)]*\)\s+)?(?<name>[A-Za-z_]\w*)\s*\(/m },
      { kind: 'class',     pattern: /^type\s+(?<name>[A-Za-z_]\w*)\s+struct\b/m },
      { kind: 'interface', pattern: /^type\s+(?<name>[A-Za-z_]\w*)\s+interface\b/m },
      { kind: 'type',      pattern: /^type\s+(?<name>[A-Za-z_]\w*)\s+[A-Za-z_]/m },
    ],
    imports: [
      { pattern: /^\s*import\s+"(?<specifier>[^"]+)"/m },
    ],
  }));

  // ---- Rust ----
  registerRegexLanguage('rust', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:const\s+)?fn\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?struct\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'enum',      pattern: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?enum\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?trait\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'type',      pattern: /^[ \t]*(?:pub(?:\([^)]*\))?\s+)?type\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*use\s+(?<specifier>[\w:]+)/m },
    ],
  }));

  // ---- Ruby ----
  registerRegexLanguage('ruby', createRegexMapper({
    docCommentLine: HASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*def\s+(?:self\.)?(?<name>[A-Za-z_]\w*[!?=]?)/m },
      { kind: 'class',     pattern: /^[ \t]*class\s+(?<name>[A-Z]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*module\s+(?<name>[A-Z]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*require\s+['"](?<specifier>[^'"]+)['"]/m },
      { pattern: /^\s*require_relative\s+['"](?<specifier>[^'"]+)['"]/m },
    ],
  }));

  // ---- Java ----
  registerRegexLanguage('java', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|protected\s+|private\s+|abstract\s+|final\s+|static\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:public\s+|protected\s+|private\s+)*interface\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'enum',      pattern: /^[ \t]*(?:public\s+|protected\s+|private\s+)*enum\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*import\s+(?:static\s+)?(?<specifier>[\w.]+)\s*;/m },
    ],
  }));

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

  // ---- C / C++ ----
  const cMapper = createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'class', pattern: /^[ \t]*(?:typedef\s+)?struct\s+(?<name>[A-Za-z_]\w*)\s*\{/m },
      { kind: 'class', pattern: /^[ \t]*class\s+(?<name>[A-Za-z_]\w*)\b/m },
      { kind: 'enum',  pattern: /^[ \t]*(?:typedef\s+)?enum\s+(?:class\s+)?(?<name>[A-Za-z_]\w*)\b/m },
    ],
    imports: [
      { pattern: /^\s*#\s*include\s*[<"](?<specifier>[^>"]+)[>"]/m },
    ],
  });
  registerRegexLanguage('c', cMapper);
  registerRegexLanguage('cpp', cMapper);

  // ---- C# ----
  registerRegexLanguage('csharp', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'class',     pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|protected\s+|abstract\s+|sealed\s+|static\s+|partial\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+|protected\s+)*interface\s+(?<name>I[A-Za-z_]\w*)/m },
      { kind: 'enum',      pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+)*enum\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'type',      pattern: /^[ \t]*(?:public\s+|private\s+|internal\s+)*struct\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*using\s+(?<specifier>[\w.]+)\s*;/m },
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

  // ---- PHP ----
  registerRegexLanguage('php', createRegexMapper({
    docCommentLine: SLASH_LINE,
    symbols: [
      { kind: 'function',  pattern: /^[ \t]*(?:public\s+|private\s+|protected\s+|static\s+|abstract\s+|final\s+)*function\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',     pattern: /^[ \t]*(?:abstract\s+|final\s+)*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'interface', pattern: /^[ \t]*interface\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /^\s*use\s+(?<specifier>[\w\\]+)/m },
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

  // ---- GDScript (Godot) ----
  registerRegexLanguage('gdscript', createRegexMapper({
    docCommentLine: HASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[ \t]*(?:static\s+)?func\s+(?<name>_?[A-Za-z_]\w*)\s*\(/m },
      { kind: 'class',    pattern: /^[ \t]*class\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'class',    pattern: /^[ \t]*class_name\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'enum',     pattern: /^[ \t]*enum\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'variable', pattern: /^[ \t]*signal\s+(?<name>[A-Za-z_]\w*)/m },
      { kind: 'variable', pattern: /^[ \t]*@export(?:\([^)]*\))?\s+(?:var|onready\s+var)\s+(?<name>[A-Za-z_]\w*)/m },
    ],
    imports: [
      { pattern: /\b(?:preload|load)\s*\(\s*['"](?<specifier>[^'"]+)['"]/m },
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

  // ---- Shell / Bash ----
  registerRegexLanguage('shell', createRegexMapper({
    docCommentLine: HASH_LINE,
    symbols: [
      { kind: 'function', pattern: /^[ \t]*(?:function\s+)?(?<name>[A-Za-z_]\w*)\s*\(\s*\)\s*\{/m },
    ],
    imports: [
      { pattern: /^\s*(?:source|\.)\s+(?<specifier>[^\s;]+)/m },
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
}
