'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/table');
const { stringWidth } = require('../src/width');

const md = (s) => s.replace(/^\n/, '').split('\n');

test('display width: ASCII, CJK, Hangul, fullwidth, emoji, flags, combining marks', () => {
  assert.equal(stringWidth('abc'), 3);
  assert.equal(stringWidth('名前'), 4);
  assert.equal(stringWidth('한국어'), 6);
  assert.equal(stringWidth('ｶﾀｶﾅ'), 4, 'halfwidth katakana stays narrow');
  assert.equal(stringWidth('ＡＢ'), 4, 'fullwidth Latin is wide');
  assert.equal(stringWidth('👍'), 2);
  assert.equal(stringWidth('👍🏽'), 2, 'skin tone modifier joins the base');
  assert.equal(stringWidth('👨‍👩‍👧'), 2, 'ZWJ family is one cluster');
  assert.equal(stringWidth('🇧🇬'), 2, 'flag');
  assert.equal(stringWidth('❤️'), 2, 'text symbol with emoji presentation selector');
  assert.equal(stringWidth('é'), 1, 'decomposed é');
  assert.equal(stringWidth('Ünïcödé'), 7);
  assert.equal(stringWidth('Привет'), 6, 'Cyrillic is narrow');
  assert.equal(stringWidth('a​b'), 2, 'zero width space');
});

test('splitRow follows GFM: only \\| escapes a pipe, outer pipes optional', () => {
  assert.deepEqual(T.splitRow('| a | b |'), ['a', 'b']);
  assert.deepEqual(T.splitRow('a | b'), ['a', 'b']);
  assert.deepEqual(T.splitRow('|a|b'), ['a', 'b']);
  assert.deepEqual(T.splitRow('| x \\| y | `c` |'), ['x \\| y', '`c`']);
  assert.deepEqual(T.splitRow('| | empty |'), ['', 'empty']);
});

test('delimiter rows', () => {
  assert.ok(T.isDelimiterRow('|---|:--:|--:|'));
  assert.ok(T.isDelimiterRow('--- | ---'));
  assert.ok(T.isDelimiterRow('| :- |'));
  assert.ok(!T.isDelimiterRow('| a | --- |'));
  assert.ok(!T.isDelimiterRow('| : | --- |'));
  assert.ok(!T.isDelimiterRow('just text'));
});

test('format aligns columns and keeps alignment markers', () => {
  const out = T.formatTable(T.parseTable(md(`
|Item|Qty|Price|Note|
|:-|:-:|-:|---|
|Apples|3|1.20|fresh|
|Bananas, ripe|12|0.5||`)));
  assert.deepEqual(out, [
    '| Item          | Qty | Price | Note  |',
    '| :------------ | :-: | ----: | ----- |',
    '| Apples        |  3  |  1.20 | fresh |',
    '| Bananas, ripe | 12  |   0.5 |       |'
  ]);
});

test('format is idempotent', () => {
  const once = T.formatTable(T.parseTable(md(`
| a | 名前 | 🇧🇬 |
|---|:--:|--:|
| 1 | 花子 | x |`)));
  assert.deepEqual(T.formatTable(T.parseTable(once)), once);
});

test('format pads by display width for CJK and emoji', () => {
  const out = T.formatTable(T.parseTable(md(`
| Name | Status |
|---|---|
| 山田太郎 | ✅ done |
| Ana | 🚧 |
| 👨‍👩‍👧 family | ok |`)));
  assert.deepEqual(out, [
    '| Name      | Status  |',
    '| --------- | ------- |',
    '| 山田太郎  | ✅ done |',
    '| Ana       | 🚧      |',
    '| 👨‍👩‍👧 family | ok      |'
  ]);
  // Every row has the same display width.
  const widths = new Set(out.map(stringWidth));
  assert.equal(widths.size, 1);
});

test('short rows are padded, long rows keep their extra cells', () => {
  const out = T.formatTable(T.parseTable(md(`
| a | b |
|---|---|
| 1 |
| 1 | 2 | 3 |`)));
  assert.deepEqual(out, [
    '| a   | b   |     |',
    '| --- | --- | --- |',
    '| 1   |     |     |',
    '| 1   | 2   | 3   |'
  ]);
});

test('indentation of a table inside a list is kept', () => {
  const out = T.formatTable(T.parseTable(['   | a | b |', '   |-|-|', '   | 1 | 2 |']));
  assert.deepEqual(out, ['   | a   | b   |', '   | --- | --- |', '   | 1   | 2   |']);
});

test('parseTable rejects text without a delimiter row', () => {
  assert.throws(() => T.parseTable(['| a | b |', '| 1 | 2 |']), /delimiter row/);
});

test('findAllTables and formatDocument skip code fences and keep other text', () => {
  const doc = [
    '# Title', '', '| a | b |', '|-|-|', '| 1 | 2 |', '', 'Text | with a pipe', '',
    '```', '| not | a table |', '|---|---|', '```', '',
    '| x |', '|:-:|', '| long value |'
  ].join('\n');
  const lines = doc.split('\n');
  assert.deepEqual(T.findAllTables(lines), [{ start: 2, end: 4 }, { start: 13, end: 15 }]);
  const out = T.formatDocument(doc).split('\n');
  assert.deepEqual(out.slice(2, 5), ['| a   | b   |', '| --- | --- |', '| 1   | 2   |']);
  assert.deepEqual(out.slice(8, 12), ['```', '| not | a table |', '|---|---|', '```']);
  assert.deepEqual(out.slice(13), ['|     x      |', '| :--------: |', '| long value |']);
  assert.equal(out[6], 'Text | with a pipe');
});

test('formatDocument keeps CRLF line endings', () => {
  assert.equal(T.formatDocument('|a|b|\r\n|-|-|\r\n|1|2|\r\n'), '| a   | b   |\r\n| --- | --- |\r\n| 1   | 2   |\r\n');
});

test('two tables separated only by a header start are found separately', () => {
  const lines = ['| a |', '|---|', '| 1 |', '| b |', '|---|', '| 2 |'];
  assert.deepEqual(T.findAllTables(lines), [{ start: 0, end: 2 }, { start: 3, end: 5 }]);
  assert.deepEqual(T.findTable(lines, 4), { start: 3, end: 5 });
  assert.equal(T.findTable(['no table'], 0), null);
});

test('columnAt and cellOffset', () => {
  const line = '| abc | de \\| f | g |';
  assert.equal(T.columnAt(line, 0), 0);
  assert.equal(T.columnAt(line, 3), 0);
  assert.equal(T.columnAt(line, 8), 1);
  assert.equal(T.columnAt(line, 12), 1, 'escaped pipe does not start a column');
  assert.equal(T.columnAt(line, 19), 2);
  assert.equal(T.cellOffset(line, 0), 2);
  assert.equal(T.cellOffset(line, 1), 8);
});

const people = () => T.parseTable(md(`
| Name | Age | City | Joined |
|---|--:|---|---|
| Émile | 34 | Sofia | 2024-05-01 |
| ana | 9 | Plovdiv | 2023-11-20 |
| Zoë | 100 | | 2025-01-15 |
| Bob | 1,200 | Varna | |`));

test('sort numeric column ascending and descending', () => {
  assert.deepEqual(T.sortByColumn(people(), 1, 'asc').rows.map((r) => r[0]), ['ana', 'Émile', 'Zoë', 'Bob']);
  assert.deepEqual(T.sortByColumn(people(), 1, 'desc').rows.map((r) => r[0]), ['Bob', 'Zoë', 'Émile', 'ana']);
});

test('sort text column ignores case and accents, empty cells last', () => {
  assert.deepEqual(T.sortByColumn(people(), 0, 'asc').rows.map((r) => r[0]), ['ana', 'Bob', 'Émile', 'Zoë']);
  assert.deepEqual(T.sortByColumn(people(), 2, 'asc').rows.map((r) => r[2]), ['Plovdiv', 'Sofia', 'Varna', '']);
  assert.deepEqual(T.sortByColumn(people(), 2, 'desc').rows.map((r) => r[2]), ['Varna', 'Sofia', 'Plovdiv', '']);
  assert.deepEqual(T.sortByColumn(people(), 3, 'asc').rows.map((r) => r[3]), ['2023-11-20', '2024-05-01', '2025-01-15', '']);
});

test('sort is stable and handles natural order, currency and percent', () => {
  const t = T.parseTable(md(`
| k | v |
|---|---|
| item 10 | $5 |
| item 2 | $5 |
| item 1 | 12% |`));
  assert.deepEqual(T.sortByColumn(t, 0, 'asc').rows.map((r) => r[0]), ['item 1', 'item 2', 'item 10']);
  assert.deepEqual(T.sortByColumn(t, 1, 'asc').rows.map((r) => r[0]), ['item 10', 'item 2', 'item 1']);
  assert.equal(T.toNumber('1,234.5'), 1234.5);
  assert.equal(T.toNumber('€ 12'), 12);
  assert.equal(T.toNumber('12a'), null);
  assert.equal(T.toNumber('-'), null);
});

test('insert, delete and move columns', () => {
  let t = T.insertColumn(people(), 1, 'New');
  assert.deepEqual(t.header, ['Name', 'New', 'Age', 'City', 'Joined']);
  assert.deepEqual(t.align, [null, null, 'right', null, null]);
  assert.equal(t.rows[0][1], '');
  t = T.deleteColumn(t, 1);
  assert.deepEqual(t.header, ['Name', 'Age', 'City', 'Joined']);
  t = T.moveColumn(t, 1, 1);
  assert.deepEqual(t.header, ['Name', 'City', 'Age', 'Joined']);
  assert.deepEqual(t.align, [null, null, 'right', null]);
  assert.deepEqual(t.rows[0], ['Émile', 'Sofia', '34', '2024-05-01']);
  assert.deepEqual(T.moveColumn(t, 0, -1).header, t.header, 'moving past the edge does nothing');
  assert.throws(() => T.deleteColumn(T.parseTable(['| a |', '|---|']), 0), /at least one column/);
  // The input table is never modified.
  const p = people();
  T.insertColumn(p, 0); T.deleteColumn(p, 0); T.moveColumn(p, 0, 1); T.sortByColumn(p, 0, 'desc');
  assert.deepEqual(p.header, ['Name', 'Age', 'City', 'Joined']);
});

test('alignColumn', () => {
  const out = T.formatTable(T.alignColumn(people(), 0, 'center'));
  assert.equal(out[1].split('|')[1].trim(), ':---:');
});

test('transpose swaps rows and columns and back again', () => {
  const t = T.parseTable(md(`
| | Q1 | Q2 |
|---|---|---|
| North | 10 | 12 |
| South | 7 | 9 |
| East | 3 | |`));
  const tt = T.transpose(t);
  assert.deepEqual(tt.header, ['', 'North', 'South', 'East']);
  assert.deepEqual(tt.rows, [['Q1', '10', '7', '3'], ['Q2', '12', '9', '']]);
  assert.deepEqual(T.transpose(tt).rows, t.rows);
});

test('CSV with quotes, doubled quotes, embedded delimiters, newlines and pipes', () => {
  const csv = 'name,city,note\n"Smith, J",Sofia,"said ""hi"""\nLee,Plovdiv,"two\nlines"\nKo,Varna,a|b\n';
  const r = T.csvToMarkdown(csv);
  assert.equal(r.delimiter, ',');
  assert.equal(r.rowCount, 3);
  assert.deepEqual(r.lines, [
    '| name     | city    | note         |',
    '| -------- | ------- | ------------ |',
    '| Smith, J | Sofia   | said "hi"    |',
    '| Lee      | Plovdiv | two<br>lines |',
    '| Ko       | Varna   | a\\|b         |'
  ]);
});

test('delimiter detection', () => {
  assert.equal(T.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(T.detectDelimiter('a;b;c\n1,5;2,5;3'), ';');
  assert.equal(T.detectDelimiter('"x;y",b,c'), ',');
  assert.equal(T.csvToMarkdown('a\tb\n1\t2').lines[2], '| 1   | 2   |');
});

test('CSV round trip: Markdown -> CSV -> Markdown', () => {
  const csv = 'name,city,note\r\n"Smith, J",Sofia,"said ""hi"""\r\nLee,Plovdiv,"two\nlines"\r\nKo,Varna,a|b\r\n';
  const table = T.parseTable(T.csvToMarkdown(csv).lines);
  const back = T.tableToDelimited(table, ',', '\r\n');
  assert.equal(back, csv);
  const tsv = T.tableToDelimited(table, '\t');
  assert.equal(tsv.split('\n')[1], 'Smith, J\tSofia\t"said ""hi"""');
});

test('ragged CSV rows are padded, BOM and blank lines ignored', () => {
  const r = T.csvToMarkdown('﻿a,b,c\n1\n\n2,3\n');
  assert.equal(r.columnCount, 3);
  assert.deepEqual(r.lines.slice(2), ['| 1   |     |     |', '| 2   | 3   |     |']);
  assert.throws(() => T.csvToMarkdown('\n\n'), /no rows/);
});

test('row operations, createTable, size spec and cellRange', () => {
  const t = T.parseTable(['| k |', '|---|', '| 1 |', '| 2 |']);
  assert.deepEqual(T.insertRow(t, 1).rows, [['1'], [''], ['2']]);
  assert.deepEqual(T.insertRow(t, 99).rows, [['1'], ['2'], ['']]);
  assert.deepEqual(T.deleteRow(t, 0).rows, [['2']]);
  assert.throws(() => T.deleteRow(t, -1), /header row/);
  assert.deepEqual(T.moveRow(t, 0, 1).rows, [['2'], ['1']]);
  assert.deepEqual(T.moveRow(t, 0, -1).rows, [['1'], ['2']], 'past the edge does nothing');
  assert.deepEqual(t.rows, [['1'], ['2']], 'input not modified');
  assert.deepEqual(T.createTable(2, 1).header, ['Column 1', 'Column 2']);
  assert.throws(() => T.createTable(0, 1), /1 to 100 columns/);
  assert.deepEqual(T.parseSizeSpec(' 4 x 7 '), { cols: 4, rows: 7 });
  assert.deepEqual(T.parseSizeSpec('5'), { cols: 5, rows: 2 });
  assert.equal(T.parseSizeSpec('x3'), null);
  const line = '| abc | de \\| f |     |';
  assert.deepEqual(T.cellRange(line, 0), [2, 5]);
  assert.equal(line.slice(...T.cellRange(line, 1)), 'de \\| f');
  assert.deepEqual(T.cellRange(line, 2), [18, 18]);
});

test('looksTabular: spreadsheet and CSV rows yes, prose and single lines no', () => {
  assert.equal(T.looksTabular('a\tb\n1\t2\n'), '\t');
  assert.equal(T.looksTabular('a\tb\r\n1\t2\r\n3\t\r\n'), '\t');
  assert.equal(T.looksTabular('city;people\nSofia;"1 300 000"'), ';');
  assert.equal(T.looksTabular('a,b,c\n1,"x, y",3'), ',');
  assert.equal(T.looksTabular('a\tb'), null, 'one line');
  assert.equal(T.looksTabular('Hello, world.\nNo commas here'), null, 'rows of different width');
  assert.equal(T.looksTabular('single\ncolumn'), null);
  assert.equal(T.looksTabular('a\tb\n1\t2\t3'), null, 'ragged rows');
  assert.equal(T.looksTabular('x,' + 'y'.repeat(300) + '\n1,2'), null, 'a long sentence with one comma is not CSV');
  assert.equal(T.looksTabular('Yes, please.\nNo, thanks.\nMaybe, later.'), null, 'prose: space after the comma');
  assert.equal(T.looksTabular('name, age\nAna, 31'), null, 'spaced CSV is ambiguous with prose; Paste as Table still converts it');
  assert.equal(T.looksTabular(''), null);
  assert.equal(T.looksTabular(null), null);
});

test('inFencedBlock', () => {
  const lines = ['text', '```js', 'a\tb', '```', 'after', '~~~', 'x', '~~~'];
  assert.deepEqual(lines.map((l, i) => T.inFencedBlock(lines, i)), [false, true, true, true, false, true, true, true]);
});
