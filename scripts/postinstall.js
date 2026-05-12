#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '..', 'wasm', 'tree-sitter-gdscript.wasm');

let wasmDir;
try {
  wasmDir = path.join(path.dirname(require.resolve('@vscode/tree-sitter-wasm/package.json')), 'wasm');
} catch {
  // @vscode/tree-sitter-wasm not installed yet — skip
  process.exit(0);
}

const dest = path.join(wasmDir, 'tree-sitter-gdscript.wasm');

if (!fs.existsSync(dest)) {
  fs.copyFileSync(src, dest);
  console.log('graphmemory: installed tree-sitter-gdscript.wasm');
}
