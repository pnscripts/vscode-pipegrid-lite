/*
 * Pipegrid table logic. Pure functions with no VS Code dependency.
 * A table is { indent, header: string[], align: (null|'left'|'center'|'right')[], rows: string[][] }.
 * Cell text is stored trimmed and exactly as written in Markdown (escaped pipes stay "\|").
 * Copyright (c) 2026 ПН СКРИПТС ЕООД / PN Scripts. MIT licence.
 */
'use strict';
const { stringWidth } = require('./width');

const DELIM_CELL = /^\s*:?-+:?\s*$/;

/** Split a Markdown table row into trimmed cells. Only "\|" escapes a pipe (GFM rule). */
function splitRow(line) {
  let s = line.trim();
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length) { cur += ch + s[i + 1]; i++; continue; }
    if (ch === '|') { cells.push(cur); cur = ''; continue; }
    cur += ch;
  }
  cells.push(cur);
  // A leading pipe makes an empty first piece, a trailing pipe an empty last piece.
  if (s.startsWith('|')) cells.shift();
  if (s.endsWith('|') && !s.endsWith('\\|') && cells.length) cells.pop();
  return cells.map((c) => c.trim());
}

function hasUnescapedPipe(line) {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '|') return true;
  }
  return false;
}

function isDelimiterRow(line) {
  if (!/[-]/.test(line) || !/^[\s|:\-]+$/.test(line)) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => DELIM_CELL.test(c));
}

function alignOf(cell) {
  const c = cell.trim();
  const l = c.startsWith(':');
  const r = c.endsWith(':');
  if (l && r) return 'center';
  if (r) return 'right';
  if (l) return 'left';
  return null;
}

/** Find the table that contains line index `at`. Returns { start, end } (end inclusive) or null. */
function findTable(lines, at) {
  return findAllTables(lines).find((t) => t.start <= at && at <= t.end) || null;
}

/** Find every table in a document. Returns [{ start, end }] in order. */
function findAllTables(lines) {
  const found = [];
  let inFence = null;
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (fence) {
      if (!inFence) inFence = fence[1][0];
      else if (fence[1][0] === inFence) inFence = null;
      continue;
    }
    if (inFence) continue;
    if (i + 1 < lines.length && hasUnescapedPipe(lines[i]) && !isDelimiterRow(lines[i]) && isDelimiterRow(lines[i + 1])) {
      let e = i + 1;
      while (e + 1 < lines.length && hasUnescapedPipe(lines[e + 1]) && lines[e + 1].trim() !== '' &&
        !(e + 2 < lines.length && isDelimiterRow(lines[e + 2]))) e++;
      found.push({ start: i, end: e });
      i = e;
    }
  }
  return found;
}

/** Parse table lines (header, delimiter, body...). */
function parseTable(lines) {
  if (lines.length < 2 || !isDelimiterRow(lines[1])) throw new Error('not a Markdown table: the second line must be a delimiter row such as | --- | --- |');
  const indent = /^\s*/.exec(lines[0])[0];
  const header = splitRow(lines[0]);
  const align = splitRow(lines[1]).map(alignOf);
  const rows = lines.slice(2).map(splitRow);
  return normalise({ indent, header, align, rows });
}

/** Make every row as wide as the widest row; nothing is dropped. */
function normalise(t) {
  const n = Math.max(t.header.length, t.align.length, ...t.rows.map((r) => r.length), 1);
  const pad = (arr, v) => { const a = arr.slice(0, n); while (a.length < n) a.push(v); return a; };
  return { indent: t.indent || '', header: pad(t.header, ''), align: pad(t.align, null), rows: t.rows.map((r) => pad(r, '')) };
}

function padCell(text, width, align) {
  const gap = width - stringWidth(text);
  if (gap <= 0) return text;
  if (align === 'right') return ' '.repeat(gap) + text;
  if (align === 'center') { const l = Math.floor(gap / 2); return ' '.repeat(l) + text + ' '.repeat(gap - l); }
  return text + ' '.repeat(gap);
}

function delimiterCell(width, align) {
  const w = Math.max(width, 3);
  if (align === 'center') return ':' + '-'.repeat(w - 2) + ':';
  if (align === 'right') return '-'.repeat(w - 1) + ':';
  if (align === 'left') return ':' + '-'.repeat(w - 1);
  return '-'.repeat(w);
}

/** Render a table as aligned Markdown lines. */
function formatTable(table) {
  const t = normalise(table);
  const widths = t.header.map((_, c) => Math.max(3, stringWidth(t.header[c]), ...t.rows.map((r) => stringWidth(r[c]))));
  const line = (cells) => t.indent + '| ' + cells.join(' | ') + ' |';
  const out = [line(t.header.map((h, c) => padCell(h, widths[c], t.align[c] === 'right' || t.align[c] === 'center' ? t.align[c] : 'left')))];
  out.push(t.indent + '|' + widths.map((w, c) => ' ' + delimiterCell(w, t.align[c]) + ' ').join('|') + '|');
  for (const r of t.rows) out.push(line(r.map((cell, c) => padCell(cell, widths[c], t.align[c]))));
  return out;
}

/** Reformat Markdown table text; returns the new text. */
function formatText(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return formatTable(parseTable(text.split(/\r?\n/))).join(eol);
}

/** Reformat every table in a document. Code fences are skipped. Returns the new text. */
function formatDocument(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const tables = findAllTables(lines);
  for (let i = tables.length - 1; i >= 0; i--) {
    const { start, end } = tables[i];
    lines.splice(start, end - start + 1, ...formatTable(parseTable(lines.slice(start, end + 1))));
  }
  return lines.join(eol);
}

/** Index of the cell that contains character `ch` of a table row. */
function columnAt(line, ch) {
  const lead = /^\s*\|?/.exec(line)[0].length;
  if (ch <= lead) return 0;
  let col = 0;
  for (let i = lead; i < Math.min(ch, line.length); i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '|') col++;
  }
  return col;
}

/** Character offset of the start of cell `col`'s text in a formatted row. */
function cellOffset(line, col) {
  let seen = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') { i++; continue; }
    if (line[i] === '|') {
      seen++;
      if (seen === col) return Math.min(i + 2, line.length);
    }
  }
  return line.length;
}

// ---------- column and row operations (all return a new table) ----------

function clone(t) {
  return { indent: t.indent, header: t.header.slice(), align: t.align.slice(), rows: t.rows.map((r) => r.slice()) };
}

function insertColumn(table, index, name) {
  const t = clone(normalise(table));
  const i = Math.max(0, Math.min(index, t.header.length));
  t.header.splice(i, 0, name || '');
  t.align.splice(i, 0, null);
  t.rows.forEach((r) => r.splice(i, 0, ''));
  return t;
}

function deleteColumn(table, index) {
  const t = clone(normalise(table));
  if (t.header.length <= 1) throw new Error('a table needs at least one column');
  if (index < 0 || index >= t.header.length) throw new Error('no column ' + index);
  t.header.splice(index, 1);
  t.align.splice(index, 1);
  t.rows.forEach((r) => r.splice(index, 1));
  return t;
}

function moveColumn(table, index, delta) {
  const t = clone(normalise(table));
  const to = index + delta;
  if (index < 0 || index >= t.header.length || to < 0 || to >= t.header.length) return t;
  const mv = (arr) => { const [x] = arr.splice(index, 1); arr.splice(to, 0, x); };
  mv(t.header); mv(t.align); t.rows.forEach(mv);
  return t;
}

/** Insert an empty body row at body index `index` (0 = first row under the header). */
function insertRow(table, index) {
  const t = clone(normalise(table));
  const i = Math.max(0, Math.min(index, t.rows.length));
  t.rows.splice(i, 0, t.header.map(() => ''));
  return t;
}

/** Delete body row `index`. The header row cannot be deleted. */
function deleteRow(table, index) {
  const t = clone(normalise(table));
  if (index < 0 || index >= t.rows.length) throw new Error('put the cursor on a body row (the header row cannot be deleted)');
  t.rows.splice(index, 1);
  return t;
}

/** Move body row `index` by delta (-1 up, +1 down). Out of range does nothing. */
function moveRow(table, index, delta) {
  const t = clone(normalise(table));
  const to = index + delta;
  if (index < 0 || index >= t.rows.length || to < 0 || to >= t.rows.length) return t;
  const [r] = t.rows.splice(index, 1);
  t.rows.splice(to, 0, r);
  return t;
}

/** A new table with `cols` columns named "Column 1"... and `rows` empty body rows. */
function createTable(cols, rows, indent) {
  if (!(cols >= 1 && cols <= 100 && rows >= 0 && rows <= 1000)) throw new Error('use 1 to 100 columns and 0 to 1000 rows');
  const header = [];
  for (let c = 1; c <= cols; c++) header.push('Column ' + c);
  const body = [];
  for (let r = 0; r < rows; r++) body.push(header.map(() => ''));
  return { indent: indent || '', header, align: header.map(() => null), rows: body };
}

/** Parse "3x4", "3 x 4", "3*4" or "3" into { cols, rows }. */
function parseSizeSpec(text) {
  const m = /^\s*(\d{1,3})\s*(?:[xX×*,]\s*(\d{1,4}))?\s*$/.exec(String(text || ''));
  if (!m) return null;
  return { cols: Number(m[1]), rows: m[2] === undefined ? 2 : Number(m[2]) };
}

/** Start and end offsets of the text of cell `col` in a formatted row (end excludes padding). */
function cellRange(line, col) {
  const start = cellOffset(line, col);
  let end = start;
  for (let i = start; i < line.length; i++) {
    if (line[i] === '\\') { i++; end = i + 1; continue; }
    if (line[i] === '|') break;
    if (line[i] !== ' ') end = i + 1;
  }
  return [start, Math.max(start, end)];
}

/** Set a column's alignment: null, 'left', 'center' or 'right'. */
function alignColumn(table, index, align) {
  const t = clone(normalise(table));
  t.align[index] = align;
  return t;
}

const NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][-+]?\d+)?\s*%?$/;
function toNumber(s) {
  const v = s.replace(/^[$€£¥]\s?/, '').trim();
  if (v === '' || !NUMBER.test(v) || !/\d/.test(v)) return null;
  return parseFloat(v.replace(/,/g, '').replace(/%$/, ''));
}

function plain(cell) {
  return cell.replace(/\\\|/g, '|').replace(/[*_`~]/g, '').trim();
}

/**
 * Sort body rows by a column. Numeric when every non-empty cell is a number
 * (thousands separators, a leading currency sign and % allowed), otherwise
 * natural text order. Empty cells always go last. The sort is stable.
 */
function sortByColumn(table, index, direction) {
  const t = clone(normalise(table));
  const dir = direction === 'desc' ? -1 : 1;
  const values = t.rows.map((r) => plain(r[index] || ''));
  const numeric = values.some((v) => v !== '') && values.every((v) => v === '' || toNumber(v) !== null);
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const order = t.rows.map((r, i) => i).sort((a, b) => {
    const va = values[a];
    const vb = values[b];
    if (va === '' && vb === '') return a - b;
    if (va === '') return 1;
    if (vb === '') return -1;
    const c = numeric ? toNumber(va) - toNumber(vb) : collator.compare(va, vb);
    return c === 0 ? a - b : c * dir;
  });
  t.rows = order.map((i) => t.rows[i]);
  return t;
}

/** Swap rows and columns. The old first column becomes the new header row. */
function transpose(table) {
  const t = normalise(table);
  const grid = [t.header].concat(t.rows);
  const cols = t.header.length;
  const out = [];
  for (let c = 0; c < cols; c++) out.push(grid.map((r) => r[c]));
  return normalise({ indent: t.indent, header: out[0], align: out[0].map(() => null), rows: out.slice(1) });
}

// ---------- CSV / TSV ----------

/** Guess the delimiter from the first line outside quotes: tab, semicolon or comma. */
function detectDelimiter(text) {
  const counts = { '\t': 0, ';': 0, ',': 0 };
  let q = false;
  for (const ch of text) {
    if (ch === '"') q = !q;
    else if (!q && (ch === '\n' || ch === '\r')) break;
    else if (!q && ch in counts) counts[ch]++;
  }
  if (counts['\t'] > 0) return '\t';
  return counts[';'] > counts[','] ? ';' : ',';
}

/** RFC 4180 style parser: quoted fields, doubled quotes, newlines inside quotes. */
function parseDelimited(text, delimiter) {
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  let i = 0;
  const s = text.replace(/^\u{feff}/u, '');
  while (i < s.length) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
        q = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === '') { q = true; i++; continue; }
    if (ch === d) { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(cell); rows.push(row); row = []; cell = '';
      if (ch === '\r' && s[i + 1] === '\n') i++;
      i++; continue;
    }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { delimiter: d, rows: rows.filter((r) => !(r.length === 1 && r[0].trim() === '')) };
}

function toCellText(value) {
  return String(value).replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').trim();
}

/** Convert CSV/TSV text to a formatted Markdown table. The first row is the header. */
function csvToMarkdown(text, options) {
  const opts = options || {};
  const { rows, delimiter } = parseDelimited(text, opts.delimiter);
  if (!rows.length) throw new Error('nothing to convert: the selection has no rows');
  const width = Math.max(...rows.map((r) => r.length));
  const header = rows[0].map(toCellText);
  while (header.length < width) header.push('');
  const table = normalise({ indent: opts.indent || '', header, align: header.map(() => null), rows: rows.slice(1).map((r) => r.map(toCellText)) });
  return { lines: formatTable(table), delimiter, rowCount: rows.length - 1, columnCount: width };
}

function fromCellText(cell) {
  return cell.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, '\n');
}

function quoteField(v, d) {
  return (v.includes(d) || v.includes('"') || v.includes('\n') || v.includes('\r') || /^\s|\s$/.test(v)) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Convert a parsed table to CSV (",") or TSV ("\t") text with a trailing newline. */
function tableToDelimited(table, delimiter, eol) {
  const d = delimiter || ',';
  const nl = eol || '\n';
  const t = normalise(table);
  return [t.header].concat(t.rows).map((r) => r.map((c) => quoteField(fromCellText(c), d)).join(d)).join(nl) + nl;
}

module.exports = {
  splitRow, isDelimiterRow, hasUnescapedPipe, findTable, findAllTables, parseTable, normalise,
  formatTable, formatText, formatDocument, columnAt, cellOffset,
  insertColumn, deleteColumn, moveColumn, alignColumn, sortByColumn, transpose,
  insertRow, deleteRow, moveRow, createTable, parseSizeSpec, cellRange,
  detectDelimiter, parseDelimited, csvToMarkdown, tableToDelimited, toNumber, stringWidth
};
