#!/usr/bin/env node
// Packages dist/pipegrid-lite-<version>.vsix with @vscode/vsce (fetched by npx if missing).
// The same .vsix is uploaded to the Visual Studio Marketplace and to Open VSX.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `pipegrid-lite-${version}.vsix`);
execFileSync('npx', ['--yes', '@vscode/vsce@3', 'package', '--out', out], { cwd: root, stdio: 'inherit' });
console.log('built', path.relative(root, out), fs.statSync(out).size, 'bytes');
