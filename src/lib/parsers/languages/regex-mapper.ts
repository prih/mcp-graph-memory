/**
 * Regex-based language parsing — fallback when no tree-sitter grammar is
 * available. Operates directly on source text using line-anchored patterns
 * to extract function/class/etc. definitions. Less accurate than tree-sitter,
 * but works for any text-based language without external grammar dependencies.
 */
import type { CodeNodeKind } from '@/graphs/code-types';
import type {
  ExtractedSymbol,
  ExtractedEdge,
  ExtractedImport,
  RegexLanguageMapper,
} from './types';

const SIGNATURE_MAX_LEN = 200;

/** A regex pattern that recognizes a category of symbol. */
export interface RegexSymbolPattern {
  /** Symbol kind to assign when this pattern matches. */
  kind: CodeNodeKind;
  /** Regex with a named group `name`. The mapper auto-applies the `gm` flags. */
  pattern: RegExp;
}

/** A regex pattern for import/include statements. */
export interface RegexImportPattern {
  /** Regex with a named group `specifier`. The mapper auto-applies the `gm` flags. */
  pattern: RegExp;
}

export interface RegexMapperOptions {
  symbols: RegexSymbolPattern[];
  imports?: RegexImportPattern[];
  /**
   * Pattern matching a single doc-comment line (e.g. /^\s*#/ for shell-style,
   * /^\s*\/\// for C-style). When set, contiguous comment lines preceding a
   * symbol are attached as its docComment.
   */
  docCommentLine?: RegExp;
}

function truncate(text: string, maxLen = SIGNATURE_MAX_LEN): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) + '…' : collapsed;
}

/** Ensure a regex has each of the required flags. */
function withFlags(re: RegExp, required: string): RegExp {
  let flags = re.flags;
  for (const f of required) if (!flags.includes(f)) flags += f;
  return new RegExp(re.source, flags);
}

/** Convert a 0-based byte offset into a 1-based line number. */
function offsetToLine(source: string, offset: number): number {
  let line = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/** Walk backward from `beforeLineIdx-1`, collecting contiguous comment lines. */
function collectDocComment(lines: string[], beforeLineIdx: number, pattern: RegExp): string {
  const collected: string[] = [];
  for (let i = beforeLineIdx - 1; i >= 0; i--) {
    const line = lines[i];
    if (line === undefined) break;
    if (pattern.test(line)) {
      collected.unshift(line.trim());
    } else {
      break;
    }
  }
  return collected.join('\n');
}

/** Drop duplicates with the same name+startLine (multiple patterns can match the same span). */
function dedupeSymbols(symbols: ExtractedSymbol[]): ExtractedSymbol[] {
  const seen = new Set<string>();
  const out: ExtractedSymbol[] = [];
  for (const s of symbols) {
    const key = `${s.name}:${s.startLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Build a RegexLanguageMapper from a set of patterns. */
export function createRegexMapper(opts: RegexMapperOptions): RegexLanguageMapper {
  const symbolPatterns = opts.symbols.map(p => ({
    ...p,
    pattern: withFlags(p.pattern, 'gm'),
  }));
  const importPatterns = (opts.imports ?? []).map(p => ({
    ...p,
    pattern: withFlags(p.pattern, 'gm'),
  }));
  const docCommentLine = opts.docCommentLine;

  return {
    extractSymbols(source: string): ExtractedSymbol[] {
      const symbols: ExtractedSymbol[] = [];
      const lines = source.split(/\r?\n/);

      for (const { kind, pattern } of symbolPatterns) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(source)) !== null) {
          if (m[0].length === 0) {
            pattern.lastIndex++;
            continue;
          }
          const name = m.groups?.name;
          if (!name) continue;
          const startLine = offsetToLine(source, m.index);
          const endLine = startLine + m[0].split(/\r?\n/).length - 1;
          const signature = truncate(lines[startLine - 1] ?? m[0]);
          const docComment = docCommentLine
            ? collectDocComment(lines, startLine - 1, docCommentLine)
            : '';
          symbols.push({
            name,
            kind,
            signature,
            docComment,
            body: m[0],
            startLine,
            endLine,
            // Regex parsing has no scope info — assume top-level definitions
            // are the public API.
            isExported: true,
          });
        }
      }

      symbols.sort((a, b) => a.startLine - b.startLine || a.name.localeCompare(b.name));
      return dedupeSymbols(symbols);
    },

    extractEdges(_source: string): ExtractedEdge[] {
      // Inheritance edges (extends/implements) are not extracted via regex.
      // Recovering them robustly across syntaxes (`extends Foo`, `: public Foo`,
      // `<: Foo`, `impl Foo for Bar`, …) is too noisy without an AST.
      return [];
    },

    extractImports(source: string): ExtractedImport[] {
      const out: ExtractedImport[] = [];
      for (const { pattern } of importPatterns) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(source)) !== null) {
          if (m[0].length === 0) {
            pattern.lastIndex++;
            continue;
          }
          const specifier = m.groups?.specifier;
          if (specifier) out.push({ specifier });
        }
      }
      return out;
    },
  };
}
