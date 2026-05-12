import path from 'path';
import fs from 'fs';
import { parseCodeFile } from '@/lib/parsers/code';
import type { ParsedFile } from '@/lib/parsers/code';

const FIXTURES = path.join(__dirname, 'fixtures', 'code');
const MTIME = 1000;

function names(pf: ParsedFile): string[] {
  return pf.nodes.filter(n => n.attrs.kind !== 'file').map(n => n.attrs.name);
}

function node(pf: ParsedFile, name: string) {
  return pf.nodes.find(n => n.attrs.name === name);
}

async function parse(ext: string, src: string): Promise<ParsedFile> {
  const tmpFile = path.join(FIXTURES, `_lang_test${ext}`);
  fs.writeFileSync(tmpFile, src);
  try {
    return await parseCodeFile(tmpFile, FIXTURES, MTIME);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

describe('python tree-sitter mapper', () => {
  const src = `
def greet(name: str) -> str:
    """Say hello."""
    return f"hello {name}"

class Animal:
    """Base animal."""
    def __init__(self, name: str):
        self.name = name

    def speak(self) -> str:
        return ""

class Dog(Animal):
    def speak(self) -> str:
        return "woof"
`.trimStart();

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.py', src); });

  it('extracts top-level function', () => { expect(names(pf)).toContain('greet'); });
  it('function kind=function', () => { expect(node(pf, 'greet')?.attrs.kind).toBe('function'); });
  it('function has docComment', () => { expect(node(pf, 'greet')?.attrs.docComment).toContain('Say hello'); });
  it('extracts class', () => { expect(names(pf)).toContain('Animal'); });
  it('class kind=class', () => { expect(node(pf, 'Animal')?.attrs.kind).toBe('class'); });
  it('extracts subclass', () => { expect(names(pf)).toContain('Dog'); });
  it('extracts __init__ as constructor', () => { expect(names(pf)).toContain('__init__'); });
  it('constructor kind=constructor', () => { expect(node(pf, '__init__')?.attrs.kind).toBe('constructor'); });
  it('extracts method', () => { expect(names(pf)).toContain('speak'); });
  it('extends edge Dog→Animal', () => {
    expect(pf.edges.some(e => e.attrs.kind === 'extends' && e.from.includes('Dog') && e.to.includes('Animal'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

describe('go tree-sitter mapper', () => {
  const src = `package main

type Server struct {
\tHost string
\tPort int
}

type Runner interface {
\tRun() error
}

func NewServer(host string) *Server {
\treturn &Server{Host: host}
}

func (s *Server) Start() error {
\treturn nil
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.go', src); });

  it('extracts function', () => { expect(names(pf)).toContain('NewServer'); });
  it('function kind=function', () => { expect(node(pf, 'NewServer')?.attrs.kind).toBe('function'); });
  it('exported func isExported=true', () => { expect(node(pf, 'NewServer')?.attrs.isExported).toBe(true); });
  it('extracts method with receiver', () => { expect(names(pf)).toContain('Start'); });
  it('method kind=method', () => { expect(node(pf, 'Start')?.attrs.kind).toBe('method'); });
  it('extracts struct type as class', () => { expect(node(pf, 'Server')?.attrs.kind).toBe('class'); });
  it('extracts interface type', () => { expect(node(pf, 'Runner')?.attrs.kind).toBe('interface'); });
  it('exported struct isExported=true', () => { expect(node(pf, 'Server')?.attrs.isExported).toBe(true); });
});

// ---------------------------------------------------------------------------
// Rust
// ---------------------------------------------------------------------------

describe('rust tree-sitter mapper', () => {
  const src = `/// A network engine.
pub struct Engine {
    pub host: String,
}

pub trait Runnable {
    fn run(&self) -> bool;
}

pub fn launch(host: &str) -> Engine {
    Engine { host: host.to_string() }
}

impl Engine {
    pub fn stop(&self) {}
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.rs', src); });

  it('extracts struct', () => { expect(names(pf)).toContain('Engine'); });
  it('struct kind=class', () => { expect(node(pf, 'Engine')?.attrs.kind).toBe('class'); });
  it('doc comment on struct', () => { expect(node(pf, 'Engine')?.attrs.docComment).toContain('network engine'); });
  it('extracts trait', () => { expect(names(pf)).toContain('Runnable'); });
  it('trait kind=interface', () => { expect(node(pf, 'Runnable')?.attrs.kind).toBe('interface'); });
  it('extracts function', () => { expect(names(pf)).toContain('launch'); });
  it('function kind=function', () => { expect(node(pf, 'launch')?.attrs.kind).toBe('function'); });
  it('extracts impl method', () => { expect(names(pf)).toContain('stop'); });
  it('impl method kind=method', () => { expect(node(pf, 'stop')?.attrs.kind).toBe('method'); });
});

// ---------------------------------------------------------------------------
// Java
// ---------------------------------------------------------------------------

describe('java tree-sitter mapper', () => {
  const src = `/**
 * Base service.
 */
public abstract class BaseService {
    protected String name;

    public BaseService(String name) {
        this.name = name;
    }

    public abstract void start();
}

public interface Lifecycle {
    void start();
    void stop();
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.java', src); });

  it('extracts class', () => { expect(names(pf)).toContain('BaseService'); });
  it('class kind=class', () => { expect(node(pf, 'BaseService')?.attrs.kind).toBe('class'); });
  it('class docComment', () => { expect(node(pf, 'BaseService')?.attrs.docComment).toContain('Base service'); });
  it('extracts interface', () => { expect(names(pf)).toContain('Lifecycle'); });
  it('interface kind=interface', () => { expect(node(pf, 'Lifecycle')?.attrs.kind).toBe('interface'); });
  it('extracts constructor', () => { expect(names(pf)).toContain('BaseService'); });
  it('extracts method', () => { expect(names(pf)).toContain('start'); });
});

// ---------------------------------------------------------------------------
// PHP
// ---------------------------------------------------------------------------

describe('php tree-sitter mapper', () => {
  const src = `<?php

function greet(string $name): string {
    return "Hello $name";
}

class User {
    private string $name;

    public function __construct(string $name) {
        $this->name = $name;
    }

    public function getName(): string {
        return $this->name;
    }
}

interface Repository {
    public function find(int $id): mixed;
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.php', src); });

  it('extracts function', () => { expect(names(pf)).toContain('greet'); });
  it('function kind=function', () => { expect(node(pf, 'greet')?.attrs.kind).toBe('function'); });
  it('extracts class', () => { expect(names(pf)).toContain('User'); });
  it('class kind=class', () => { expect(node(pf, 'User')?.attrs.kind).toBe('class'); });
  it('extracts interface', () => { expect(names(pf)).toContain('Repository'); });
  it('interface kind=interface', () => { expect(node(pf, 'Repository')?.attrs.kind).toBe('interface'); });
  it('extracts method', () => { expect(names(pf)).toContain('getName'); });
  it('extracts constructor', () => { expect(names(pf)).toContain('__construct'); });
});

// ---------------------------------------------------------------------------
// Ruby
// ---------------------------------------------------------------------------

describe('ruby tree-sitter mapper', () => {
  const src = `class Dog
  def initialize(name)
    @name = name
  end

  def speak
    "woof"
  end
end

module Utilities
end

def top_level_helper
  42
end
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.rb', src); });

  it('extracts class', () => { expect(names(pf)).toContain('Dog'); });
  it('class kind=class', () => { expect(node(pf, 'Dog')?.attrs.kind).toBe('class'); });
  it('extracts initialize as constructor', () => { expect(names(pf)).toContain('initialize'); });
  it('constructor kind=constructor', () => { expect(node(pf, 'initialize')?.attrs.kind).toBe('constructor'); });
  it('extracts instance method', () => { expect(names(pf)).toContain('speak'); });
  it('instance method kind=method', () => { expect(node(pf, 'speak')?.attrs.kind).toBe('method'); });
  it('extracts module', () => { expect(names(pf)).toContain('Utilities'); });
  it('module kind=interface', () => { expect(node(pf, 'Utilities')?.attrs.kind).toBe('interface'); });
  it('extracts top-level method', () => { expect(names(pf)).toContain('top_level_helper'); });
  it('top-level method kind=function', () => { expect(node(pf, 'top_level_helper')?.attrs.kind).toBe('function'); });
});

// ---------------------------------------------------------------------------
// C# (csharp)
// ---------------------------------------------------------------------------

describe('csharp tree-sitter mapper', () => {
  const src = `/// <summary>Base service class.</summary>
public abstract class BaseService {
    public BaseService() {}

    /// <summary>Start the service.</summary>
    public abstract void Start();
}

public interface ILifecycle {
    void Start();
}

public struct Point {
    public int X;
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.cs', src); });

  it('extracts class', () => { expect(names(pf)).toContain('BaseService'); });
  it('class kind=class', () => { expect(node(pf, 'BaseService')?.attrs.kind).toBe('class'); });
  it('extracts interface', () => { expect(names(pf)).toContain('ILifecycle'); });
  it('interface kind=interface', () => { expect(node(pf, 'ILifecycle')?.attrs.kind).toBe('interface'); });
  it('extracts struct as type', () => { expect(node(pf, 'Point')?.attrs.kind).toBe('type'); });
  it('extracts method as child of class', () => { expect(names(pf)).toContain('Start'); });
  it('method kind=method', () => { expect(node(pf, 'Start')?.attrs.kind).toBe('method'); });
  it('extracts constructor', () => { expect(names(pf)).toContain('BaseService'); });
});

// ---------------------------------------------------------------------------
// C / C++
// ---------------------------------------------------------------------------

describe('cpp tree-sitter mapper', () => {
  const src = `namespace net {
    class Server {
    public:
        void start();
    };
}

int add(int a, int b) {
    return a + b;
}
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.cpp', src); });

  it('extracts namespace', () => { expect(names(pf)).toContain('net'); });
  it('namespace kind=interface', () => { expect(node(pf, 'net')?.attrs.kind).toBe('interface'); });
  it('extracts class', () => { expect(names(pf)).toContain('Server'); });
  it('class kind=class', () => { expect(node(pf, 'Server')?.attrs.kind).toBe('class'); });
  it('extracts top-level function', () => { expect(names(pf)).toContain('add'); });
  it('function kind=function', () => { expect(node(pf, 'add')?.attrs.kind).toBe('function'); });
});

// ---------------------------------------------------------------------------
// Bash
// ---------------------------------------------------------------------------

describe('bash tree-sitter mapper', () => {
  const src = `#!/usr/bin/env bash

deploy() {
    echo "deploying..."
}

function rollback {
    echo "rolling back"
}

main() {
    deploy
    rollback
}

main "$@"
`;

  let pf: ParsedFile;
  beforeAll(async () => { pf = await parse('.sh', src); });

  it('extracts posix-style function', () => { expect(names(pf)).toContain('deploy'); });
  it('extracts function-keyword function', () => { expect(names(pf)).toContain('rollback'); });
  it('extracts main', () => { expect(names(pf)).toContain('main'); });
  it('function kind=function', () => { expect(node(pf, 'deploy')?.attrs.kind).toBe('function'); });
});
