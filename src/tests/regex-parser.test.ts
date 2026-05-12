import { createRegexMapper } from '@/lib/parsers/languages/regex-mapper';
import {
  registerRegexLanguages,
  getRegexMapper,
  isRegexLanguageSupported,
} from '@/lib/parsers/languages';

beforeAll(() => {
  registerRegexLanguages();
});

describe('createRegexMapper', () => {
  const mapper = createRegexMapper({
    docCommentLine: /^\s*#/,
    symbols: [
      { kind: 'function', pattern: /^def\s+(?<name>\w+)\s*\(/m },
      { kind: 'class',    pattern: /^class\s+(?<name>\w+)/m },
    ],
    imports: [
      { pattern: /^import\s+(?<specifier>\S+)/m },
    ],
  });

  it('extracts function name', () => {
    const out = mapper.extractSymbols('def hello(x):\n    pass\n');
    expect(out.map(s => s.name)).toEqual(['hello']);
    expect(out[0].kind).toBe('function');
    expect(out[0].startLine).toBe(1);
  });

  it('extracts class name', () => {
    const out = mapper.extractSymbols('class Foo:\n    pass\n');
    expect(out.map(s => s.name)).toEqual(['Foo']);
    expect(out[0].kind).toBe('class');
  });

  it('extracts both functions and classes from same source', () => {
    const src = 'class Foo:\n    pass\ndef bar():\n    pass\n';
    const out = mapper.extractSymbols(src);
    expect(out).toHaveLength(2);
    expect(out.map(s => s.name).sort()).toEqual(['Foo', 'bar']);
  });

  it('attaches preceding comment lines as docComment', () => {
    const src = '# helper for things\n# does X then Y\ndef hello():\n    pass\n';
    const out = mapper.extractSymbols(src);
    expect(out[0].docComment).toContain('helper for things');
    expect(out[0].docComment).toContain('does X then Y');
  });

  it('extracts imports', () => {
    const out = mapper.extractImports('import os\nimport sys.path\n');
    expect(out.map(i => i.specifier)).toEqual(['os', 'sys.path']);
  });

  it('returns empty edges array (regex parsing has no AST)', () => {
    expect(mapper.extractEdges('class Foo extends Bar {}')).toEqual([]);
  });

  it('reports correct line numbers for multi-line source', () => {
    const src = '\n\n\ndef hello():\n    pass\n';
    const out = mapper.extractSymbols(src);
    expect(out[0].startLine).toBe(4);
  });

  it('handles empty source', () => {
    expect(mapper.extractSymbols('')).toEqual([]);
    expect(mapper.extractImports('')).toEqual([]);
  });

  it('skips matches without a "name" group', () => {
    const noNameMapper = createRegexMapper({
      symbols: [{ kind: 'function', pattern: /^def\s+\w+/m }],
    });
    expect(noNameMapper.extractSymbols('def foo():\n')).toEqual([]);
  });

  it('marks symbols as exported (regex has no scope info)', () => {
    const out = mapper.extractSymbols('def hello():\n    pass\n');
    expect(out[0].isExported).toBe(true);
  });
});

describe('built-in regex languages', () => {
  it('glsl is registered', () => {
    expect(isRegexLanguageSupported('glsl')).toBe(true);
  });

  it('python is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('python')).toBe(false);
  });

  it('go is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('go')).toBe(false);
  });

  it('rust is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('rust')).toBe(false);
  });

  it('gdscript is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('gdscript')).toBe(false);
  });

  it('typescript is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('typescript')).toBe(false);
  });

  describe('glsl mapper', () => {
    const glsl = getRegexMapper('glsl')!;
    it('extracts uniform', () => {
      const out = glsl.extractSymbols('uniform float bass_impact;\n');
      expect(out.map(s => s.name)).toContain('bass_impact');
    });
    it('extracts function', () => {
      const out = glsl.extractSymbols('vec3 fade(vec3 c, float t) {\n    return c * t;\n}\n');
      expect(out.map(s => s.name)).toContain('fade');
    });
  });
});
