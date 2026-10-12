/*
 * Pipegrid display width: how many monospace columns a string takes.
 * Wide and fullwidth characters (CJK ideographs, kana, Hangul, fullwidth
 * forms) and emoji count as 2, combining marks and joiners as 0, everything
 * else as 1. Grapheme clusters (an emoji with skin tone, a flag, a family
 * sequence) are measured as one unit.
 * Copyright (c) 2026 ПН СКРИПТС ЕООД / PN Scripts. MIT licence.
 */
'use strict';

// East Asian Wide (W) and Fullwidth (F) ranges, condensed from Unicode UAX #11.
const WIDE = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0],
  [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f],
  [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5],
  [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5],
  [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728],
  [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xa960, 0xa97f], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f],
  [0xff00, 0xff60], [0xffe0, 0xffe6], [0x16fe0, 0x16fe4], [0x17000, 0x18cff], [0x1b000, 0x1b2ff],
  [0x1f004, 0x1f004], [0x1f0cf, 0x1f0cf], [0x1f18e, 0x1f18e], [0x1f191, 0x1f19a], [0x1f200, 0x1f251],
  [0x1f300, 0x1f320], [0x1f32d, 0x1f335], [0x1f337, 0x1f37c], [0x1f37e, 0x1f393], [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3], [0x1f3e0, 0x1f3f0], [0x1f3f4, 0x1f3f4], [0x1f3f8, 0x1f43e], [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc], [0x1f4ff, 0x1f53d], [0x1f54b, 0x1f54e], [0x1f550, 0x1f567], [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596], [0x1f5a4, 0x1f5a4], [0x1f5fb, 0x1f64f], [0x1f680, 0x1f6c5], [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2], [0x1f6d5, 0x1f6d7], [0x1f6dc, 0x1f6df], [0x1f6eb, 0x1f6ec], [0x1f6f4, 0x1f6fc],
  [0x1f7e0, 0x1f7eb], [0x1f7f0, 0x1f7f0], [0x1f90c, 0x1f93a], [0x1f93c, 0x1f945], [0x1f947, 0x1f9ff],
  [0x1fa70, 0x1faff], [0x20000, 0x2fffd], [0x30000, 0x3fffd]
];

function isWide(cp) {
  let lo = 0;
  let hi = WIDE.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < WIDE[mid][0]) hi = mid - 1;
    else if (cp > WIDE[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

const ZERO_WIDTH = /^[\u{300}-\u{36f}\u{483}-\u{489}\u{591}-\u{5bd}\u{610}-\u{61a}\u{64b}-\u{65f}\u{e31}\u{e34}-\u{e3a}\u{e47}-\u{e4e}\u{1ab0}-\u{1aff}\u{1dc0}-\u{1dff}\u{200b}-\u{200f}\u{2028}-\u{202e}\u{2060}-\u{2064}\u{20d0}-\u{20ff}\u{fe00}-\u{fe0f}\u{fe20}-\u{fe2f}\u{feff}]$/u;
const PICTO = /\p{Extended_Pictographic}/u;
const REGIONAL = /[\u{1f1e6}-\u{1f1ff}]/u;

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

function graphemes(str) {
  if (segmenter) return Array.from(segmenter.segment(str), (s) => s.segment);
  return Array.from(str);
}

/** Width of one grapheme cluster. */
function clusterWidth(g) {
  const cp = g.codePointAt(0);
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (cp < 0x300) return 1; // fast path: Latin, Latin-1, Latin Extended
  if (g.length === 1 && ZERO_WIDTH.test(g)) return 0;
  if (isWide(cp)) return 2;
  if (REGIONAL.test(g)) return 2; // flags (and lone regional indicators)
  // A pictographic base turned into emoji style (VS16) or joined into a sequence.
  if (PICTO.test(g) && (/\u{fe0f}|\u{200d}/u.test(g) || /[\u{1f3fb}-\u{1f3ff}]/u.test(g))) return 2;
  const first = String.fromCodePoint(cp);
  if (ZERO_WIDTH.test(first)) return 0;
  return 1;
}

/** Display width of a string in monospace columns. */
function stringWidth(str) {
  let w = 0;
  for (const g of graphemes(String(str))) w += clusterWidth(g);
  return w;
}

module.exports = { stringWidth, isWide, clusterWidth };
