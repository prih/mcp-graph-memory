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
  it('python is registered', () => {
    expect(isRegexLanguageSupported('python')).toBe(true);
  });

  it('go is registered', () => {
    expect(isRegexLanguageSupported('go')).toBe(true);
  });

  it('rust is registered', () => {
    expect(isRegexLanguageSupported('rust')).toBe(true);
  });

  it('gdscript is registered', () => {
    expect(isRegexLanguageSupported('gdscript')).toBe(true);
  });

  it('glsl is registered', () => {
    expect(isRegexLanguageSupported('glsl')).toBe(true);
  });

  it('typescript is NOT regex-registered (handled by tree-sitter)', () => {
    expect(isRegexLanguageSupported('typescript')).toBe(false);
  });

  describe('python mapper', () => {
    const py = getRegexMapper('python')!;
    it('extracts def', () => {
      expect(py.extractSymbols('def foo():\n    pass\n').map(s => s.name)).toEqual(['foo']);
    });
    it('extracts async def', () => {
      expect(py.extractSymbols('async def foo():\n    pass\n').map(s => s.name)).toEqual(['foo']);
    });
    it('extracts class', () => {
      expect(py.extractSymbols('class Foo(Base):\n    pass\n').map(s => s.name)).toEqual(['Foo']);
    });
    it('extracts from … import', () => {
      expect(py.extractImports('from os.path import join\n').map(i => i.specifier)).toEqual(['os.path']);
    });
    it('extracts plain import', () => {
      expect(py.extractImports('import sys\n').map(i => i.specifier)).toEqual(['sys']);
    });
  });

  describe('go mapper', () => {
    const go = getRegexMapper('go')!;
    it('extracts func', () => {
      expect(go.extractSymbols('func Hello() {}\n').map(s => s.name)).toEqual(['Hello']);
    });
    it('extracts method receiver func', () => {
      expect(go.extractSymbols('func (s *Server) Run() {}\n').map(s => s.name)).toEqual(['Run']);
    });
    it('extracts struct type', () => {
      const out = go.extractSymbols('type Server struct {}\n');
      expect(out.map(s => s.name)).toEqual(['Server']);
      expect(out[0].kind).toBe('class');
    });
    it('extracts import', () => {
      expect(go.extractImports('import "fmt"\n').map(i => i.specifier)).toEqual(['fmt']);
    });
  });

  describe('rust mapper', () => {
    const rs = getRegexMapper('rust')!;
    it('extracts pub fn', () => {
      expect(rs.extractSymbols('pub fn launch() {}\n').map(s => s.name)).toEqual(['launch']);
    });
    it('extracts struct', () => {
      expect(rs.extractSymbols('pub struct Engine {}\n').map(s => s.name)).toEqual(['Engine']);
    });
    it('extracts trait', () => {
      const out = rs.extractSymbols('pub trait Runnable {}\n');
      expect(out[0].kind).toBe('interface');
    });
  });

  describe('gdscript mapper', () => {
    const gd = getRegexMapper('gdscript')!;
    it('extracts func', () => {
      const src = 'func _ready():\n\tpass\nfunc fire(target):\n\tpass\n';
      expect(gd.extractSymbols(src).map(s => s.name)).toEqual(['_ready', 'fire']);
    });
    it('extracts class_name', () => {
      const out = gd.extractSymbols('class_name Player\nextends Node\n');
      expect(out.map(s => s.name)).toContain('Player');
    });
    it('extracts signal', () => {
      const out = gd.extractSymbols('signal hit_target\n');
      expect(out.map(s => s.name)).toEqual(['hit_target']);
    });
    it('extracts preload import', () => {
      const out = gd.extractImports('var Bullet = preload("res://scenes/bullet.tscn")\n');
      expect(out.map(i => i.specifier)).toEqual(['res://scenes/bullet.tscn']);
    });
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
