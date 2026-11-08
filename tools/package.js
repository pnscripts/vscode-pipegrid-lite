#!/usr/bin/env node
// Packages dist/pipegrid-lite-<version>.vsix with @vscode/vsce (the pinned development dependency).
// The same .vsix is uploaded to the Visual Studio Marketplace and to Open VSX. vsce refuses a
// manifest or README the Marketplace would reject, so CI runs this as the store's own check.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', `pipegrid-lite-${version}.vsix`);
// The extension has no runtime dependencies, so node_modules (the build tools) never goes in.
execFileSync(path.join(root, 'node_modules', '.bin', 'vsce'), ['package', '--no-dependencies', '--out', out], { cwd: root, stdio: 'inherit' });
console.log('built', path.relative(root, out), fs.statSync(out).size, 'bytes');
