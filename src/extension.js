/*
 * Pipegrid Lite for VS Code: format and create Markdown tables.
 * All table logic lives in table.js; this file only talks to the editor.
 * Copyright (c) 2026 ПН СКРИПТС ЕООД / PN Scripts. MIT licence.
 */
'use strict';
const vscode = require('vscode');
const T = require('./table');

const NO_TABLE = 'Pipegrid Lite: put the cursor inside a Markdown table (a header row, a | --- | row, then body rows).';

function docLines(doc) {
  const out = [];
  for (let i = 0; i < doc.lineCount; i++) out.push(doc.lineAt(i).text);
  return out;
}

function eolOf(doc) {
  return doc.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
}

/** Align the table under the cursor and keep the cursor in its cell. */
async function formatTable(editor) {
  const doc = editor.document;
  const lines = docLines(doc);
  const pos = editor.selection.active;
  const found = T.findTable(lines, pos.line);
  if (!found) { vscode.window.showInformationMessage(NO_TABLE); return false; }
  const table = T.parseTable(lines.slice(found.start, found.end + 1));
  const col = Math.min(T.columnAt(lines[pos.line], pos.character), table.header.length - 1);
  const out = T.formatTable(table);
  if (out.join('\n') !== lines.slice(found.start, found.end + 1).join('\n')) {
    const range = new vscode.Range(found.start, 0, found.end, lines[found.end].length);
    const ok = await editor.edit((eb) => eb.replace(range, out.join(eolOf(doc))));
    if (!ok) return false;
  }
  const offset = Math.min(pos.line - found.start, out.length - 1);
  const ch = T.cellOffset(out[offset], Math.max(0, col));
  editor.selection = new vscode.Selection(found.start + offset, ch, found.start + offset, ch);
  return true;
}

function allTableEdits(doc) {
  const lines = docLines(doc);
  const eol = eolOf(doc);
  const edits = [];
  for (const { start, end } of T.findAllTables(lines)) {
    const before = lines.slice(start, end + 1);
    const after = T.formatTable(T.parseTable(before));
    if (after.join('\n') !== before.join('\n')) {
      edits.push(vscode.TextEdit.replace(new vscode.Range(start, 0, end, lines[end].length), after.join(eol)));
    }
  }
  return edits;
}

async function formatAll(editor) {
  const edits = allTableEdits(editor.document);
  if (!edits.length) { vscode.window.setStatusBarMessage('Pipegrid Lite: all tables already formatted', 3000); return; }
  await editor.edit((eb) => edits.forEach((e) => eb.replace(e.range, e.newText)));
  vscode.window.setStatusBarMessage('Pipegrid Lite: formatted ' + edits.length + (edits.length === 1 ? ' table' : ' tables'), 3000);
}

async function createTable(editor) {
  const valid = (v) => { const s = T.parseSizeSpec(v); return !!s && s.cols >= 1 && s.cols <= 100 && s.rows <= 1000; };
  const answer = await vscode.window.showInputBox({
    prompt: 'Table size as columns x rows',
    placeHolder: '3x4',
    value: '3x2',
    validateInput: (v) => (valid(v) ? null : 'Write columns x rows, for example 3x4 (1 to 100 columns, up to 1000 rows)')
  });
  if (!valid(answer)) return;
  const size = T.parseSizeSpec(answer);
  const doc = editor.document;
  const pos = editor.selection.active;
  const lineText = doc.lineAt(pos.line).text;
  const indent = /^ */.exec(lineText)[0];
  const out = T.formatTable(T.createTable(size.cols, size.rows, indent));
  const eol = eolOf(doc);
  // Put the table on its own lines, with a blank line before it when needed.
  const blankLine = lineText.trim() === '';
  const text = (blankLine ? '' : eol + eol) + out.join(eol);
  await editor.edit((eb) => blankLine
    ? eb.replace(new vscode.Range(pos.line, 0, pos.line, lineText.length), text)
    : eb.insert(new vscode.Position(pos.line, lineText.length), text));
  const firstLine = blankLine ? pos.line : pos.line + 2;
  const [a, b] = T.cellRange(out[0], 0);
  editor.selection = new vscode.Selection(firstLine, a, firstLine, b);
}

const COMMANDS = {
  'pipegridLite.formatTable': formatTable,
  'pipegridLite.formatAllTables': formatAll,
  'pipegridLite.createTable': createTable
};

function activate(context) {
  for (const [id, fn] of Object.entries(COMMANDS)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { vscode.window.showInformationMessage('Pipegrid Lite: open a Markdown file first.'); return undefined; }
      return fn(editor);
    }));
  }
  context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((e) => {
    if (e.document.languageId !== 'markdown') return;
    if (!vscode.workspace.getConfiguration('pipegridLite', e.document.uri).get('formatOnSave', false)) return;
    e.waitUntil(Promise.resolve(allTableEdits(e.document)));
  }));
}

function deactivate() {}

module.exports = { activate, deactivate, COMMANDS };
