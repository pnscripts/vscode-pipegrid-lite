'use strict';
// Runs the real src/extension.js against an in-memory VS Code API.
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fake = require('./fake-vscode').create();

const origLoad = Module._load;
Module._load = function (request, ...rest) { return request === 'vscode' ? fake.api : origLoad.call(this, request, ...rest); };
const ext = require('../src/extension');
Module._load = origLoad;

ext.activate({ subscriptions: [] });
const run = (id, editor) => { fake.api.window.activeTextEditor = editor; return fake.state.commands[id](); };
const { FakeEditor } = fake;
const pkg = require('../package.json');

test('every command in package.json is registered, and the other way round', () => {
  const declared = pkg.contributes.commands.map((c) => c.command).sort();
  assert.deepEqual(Object.keys(fake.state.commands).sort(), declared);
  assert.deepEqual(pkg.contributes.menus.commandPalette.map((m) => m.command).sort(), declared);
});

const doc = ['Intro', '', '|Fruit|Qty|Price|', '|-|-:|-:|', '|Pear|12|0.80|', '|Apple|3|1.20|', '', 'End'].join('\n');
const formatted = ['Intro', '', '| Fruit | Qty | Price |', '| ----- | --: | ----: |', '| Pear  |  12 |  0.80 |', '| Apple |   3 |  1.20 |', '', 'End'].join('\n');

test('format table at cursor leaves other text alone and keeps the cursor in its cell', async () => {
  const ed = new FakeEditor(doc, 4, 7);
  await run('pipegridLite.formatTable', ed);
  assert.equal(ed.document.text, formatted);
  assert.equal(ed.selection.active.line, 4);
  assert.equal(ed.document.lineAt(4).text.slice(ed.selection.active.character).trim().startsWith('12'), true);
});

test('outside a table it explains what to do', async () => {
  fake.state.messages.length = 0;
  const ed = new FakeEditor(doc, 0, 0);
  assert.equal(await run('pipegridLite.formatTable', ed), false);
  assert.match(fake.state.messages[0], /put the cursor inside a Markdown table/);
});

test('format all tables formats every table and skips code fences', async () => {
  const text = ['|a|b|', '|-|-|', '|1|22|', '', '```', '|x|y|', '|-|-|', '```', '', '|wide|', '|-|', '|日本語|'].join('\n');
  const ed = new FakeEditor(text, 0, 0);
  await run('pipegridLite.formatAllTables', ed);
  assert.equal(ed.document.text, ['| a   | b   |', '| --- | --- |', '| 1   | 22  |', '', '```', '|x|y|', '|-|-|', '```', '', '| wide   |', '| ------ |', '| 日本語 |'].join('\n'));
});

test('create table inserts an aligned empty table and selects the first header cell', async () => {
  fake.state.inputBox = '2x1';
  const ed = new FakeEditor('Text', 0, 4);
  await run('pipegridLite.createTable', ed);
  const lines = ed.document.text.split('\n');
  assert.equal(lines[0], 'Text');
  assert.equal(lines[1], '');
  assert.equal(lines.length, 5);
  assert.match(lines[3], /^\| -+ \| -+ \|$/);
  assert.equal(ed.selection.start.line, 2);
  assert.equal(fake.state.lastInputBox.validateInput('0x0') !== null, true);
  assert.equal(fake.state.lastInputBox.validateInput('3x4'), null);
});

test('format on save is off by default and formats when switched on', async () => {
  const saveDoc = new FakeEditor(doc, 0, 0).document;
  const waited = [];
  fake.state.willSave[0]({ document: saveDoc, waitUntil: (p) => waited.push(p) });
  assert.equal(waited.length, 0);
  fake.state.config.formatOnSave = true;
  fake.state.willSave[0]({ document: saveDoc, waitUntil: (p) => waited.push(p) });
  const edits = await waited[0];
  assert.equal(edits.length, 1);
  fake.state.config.formatOnSave = false;
});

test('Ctrl+V of spreadsheet cells: table outside code blocks, nothing for prose, CSV or a code block', async () => {
  const { provider, metadata } = fake.state.paste;
  assert.equal(metadata.providedPasteEditKinds[0].value, 'markdown.table.pipegridLite');
  const transfer = (text) => ({ get: (m) => (m === 'text/plain' ? { asString: async () => text } : undefined) });
  const sheet = 'Name\tScore\r\nAna\t31\r\n東京\t7\r\n';
  const doc = new fake.FakeDocument('Results:');
  const edits = await provider.provideDocumentPasteEdits(doc, [new fake.api.Range(0, 8, 0, 8)], transfer(sheet), {}, {});
  assert.equal(edits[0].insertText, '\n\n| Name | Score |\n| ---- | ----- |\n| Ana  | 31    |\n| 東京 | 7     |');
  assert.match(edits[0].title, /\(2 rows x 2 columns\)/);
  const at0 = new fake.api.Range(0, 0, 0, 0);
  assert.equal(await provider.provideDocumentPasteEdits(new fake.FakeDocument(''), [at0], transfer('a,b\n1,2'), {}, {}), undefined);
  assert.equal(await provider.provideDocumentPasteEdits(new fake.FakeDocument(''), [at0], transfer('Hello world'), {}, {}), undefined);
  assert.equal(await provider.provideDocumentPasteEdits(new fake.FakeDocument('```\n\n```'), [new fake.api.Range(1, 0, 1, 0)], transfer(sheet), {}, {}), undefined);
  fake.state.config.pasteSpreadsheetAsTable = false;
  assert.equal(await provider.provideDocumentPasteEdits(new fake.FakeDocument(''), [at0], transfer(sheet), {}, {}), undefined);
  delete fake.state.config.pasteSpreadsheetAsTable;
});
