#!/usr/bin/env node
// Icon and store images at exact sizes (rendered by tools/render.mjs).
import { icon, banner, slide, esc } from './brand.mjs';
import { createRequire } from 'node:module';
const T = createRequire(import.meta.url)('../src/table.js');
const before = ['| Fruit | 数量 |Price|', '|-|-:|-:|', '|Pear 🍐|12|0.80|', '|りんご|3|1.20|'].join('\n');
const after = T.formatTable(T.parseTable(before.split(String.fromCharCode(10)))).join(String.fromCharCode(10));
const shot = slide(1280, 800, { kicker: 'Format Table', title: 'Pipes line up, even with CJK text and emoji', body:
  `<span style="color:#9b3b2b">${esc(before)}</span>\n\n<span style="color:#5d6762">Pipegrid Lite: Format Table  (or format on save)</span>\n\n<span style="color:#2f7d5b">${esc(after)}</span>` });
export default [
  { out: 'images/icon.png', width: 256, height: 256, html: icon(256, '|‖|') },
  { out: 'listing/screenshot-format-table-1280x800.png', width: 1280, height: 800, html: shot },
  { out: 'listing/banner-1400x560.png', width: 1400, height: 560, html: banner(1400, 560, { name: 'Pipegrid Lite', tagline: 'Aligned Markdown tables in VS Code, measured in display columns so CJK and emoji line up.', chips: ['Format table', 'Format all', 'Format on save', 'Create table'], glyph: '|‖|' }) }
];
