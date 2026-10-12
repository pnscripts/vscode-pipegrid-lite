'use strict';
// A small in-memory stand-in for the parts of the VS Code API Pipegrid uses.
class Position { constructor(line, character) { this.line = line; this.character = character; } }
class Range {
  constructor(a, b, c, d) {
    if (a instanceof Position) { this.start = a; this.end = b; } else { this.start = new Position(a, b); this.end = new Position(c, d); }
  }
  get isEmpty() { return this.start.line === this.end.line && this.start.character === this.end.character; }
}
class Selection extends Range {
  constructor(a, b, c, d) { super(a, b, c, d); this.anchor = this.start; this.active = this.end; }
}
const EndOfLine = { LF: 1, CRLF: 2 };

function offsetOf(text, pos) {
  const lines = text.split('\n');
  let o = 0;
  for (let i = 0; i < pos.line; i++) o += lines[i].length + 1;
  return o + pos.character;
}

class FakeDocument {
  constructor(text, languageId) { this.text = text; this.languageId = languageId || 'markdown'; this.eol = EndOfLine.LF; this.uri = {}; }
  get lineCount() { return this.text.split('\n').length; }
  lineAt(i) { return { text: this.text.split('\n')[i] }; }
  getText(range) { return range ? this.text.slice(offsetOf(this.text, range.start), offsetOf(this.text, range.end)) : this.text; }
}

class FakeEditor {
  constructor(text, line, character) { this.document = new FakeDocument(text); this.selection = new Selection(line, character, line, character); }
  get selections() { return [this.selection]; }
  async edit(cb) {
    const edits = [];
    cb({ replace: (range, newText) => edits.push({ range, newText }), insert: (pos, newText) => edits.push({ range: new Range(pos, pos), newText }) });
    edits.sort((a, b) => offsetOf(this.document.text, b.range.start) - offsetOf(this.document.text, a.range.start));
    for (const e of edits) {
      const t = this.document.text;
      this.document.text = t.slice(0, offsetOf(t, e.range.start)) + e.newText + t.slice(offsetOf(t, e.range.end));
    }
    return true;
  }
}

function create() {
  const state = { commands: {}, messages: [], config: { formatOnSave: false, csvDelimiter: 'auto' }, clipboard: '', willSave: [], quickPick: null, inputBox: null, context: {}, selListeners: [], editorListeners: [] };
  const api = {
    Position, Range, Selection, EndOfLine,
    TextEdit: { replace: (range, newText) => ({ range, newText }) },
    window: {
      showInformationMessage: (m) => state.messages.push(m),
      showWarningMessage: (m) => state.messages.push(m),
      setStatusBarMessage: (m) => state.messages.push(m),
      activeTextEditor: null,
      onDidChangeTextEditorSelection: (fn) => { state.selListeners.push(fn); return { dispose() {} }; },
      onDidChangeActiveTextEditor: (fn) => { state.editorListeners.push(fn); return { dispose() {} }; },
      showInputBox: async (o) => { state.lastInputBox = o; return state.inputBox; },
      showQuickPick: async (items) => items.find((i) => i.label === state.quickPick)
    },
    workspace: {
      getConfiguration: () => ({ get: (k, d) => (k in state.config ? state.config[k] : d) }),
      onWillSaveTextDocument: (fn) => { state.willSave.push(fn); return { dispose() {} }; }
    },
    commands: {
      registerCommand: (id, fn) => { state.commands[id] = fn; return { dispose() {} }; },
      executeCommand: async (id, key, value) => { if (id === 'setContext') state.context[key] = value; }
    },
    env: { clipboard: { writeText: async (t) => { state.clipboard = t; } } }
  };
  return { api, state, FakeEditor, FakeDocument };
}

module.exports = { create };
