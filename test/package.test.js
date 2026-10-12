'use strict';
// Marketplace rules: PNG icon of at least 128 px, no SVG images, MIT, no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const pkg = require('../package.json');

test('manifest fields the Marketplace and Open VSX need', () => {
  assert.equal(pkg.publisher, 'pnscripts');
  assert.equal(pkg.license, 'MIT');
  assert.ok(pkg.engines.vscode);
  assert.ok(pkg.repository.url.startsWith('https://'));
  assert.ok(pkg.keywords.length <= 30);
  const png = fs.readFileSync(path.join(root, pkg.icon));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.ok(png.readUInt32BE(16) >= 128 && png.readUInt32BE(20) >= 128);
});

test('README images are https PNG or JPG, never SVG', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const m of readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    assert.match(m[1], /^https:\/\/.+\.(png|jpg)$/);
  }
});

test('no network calls in the extension', () => {
  for (const f of fs.readdirSync(path.join(root, 'src'))) {
    const code = fs.readFileSync(path.join(root, 'src', f), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|require\('https?'\)/.test(code), f);
    assert.match(code, /MIT licence/);
  }
});
