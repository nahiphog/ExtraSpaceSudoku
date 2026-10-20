import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseString, toString, findSolutions, copyGridImage} from '../dist/verify/verify.js';
import {makeWalkthrough} from '../dist/walkthrough.js';

const source = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8').split("button.addEventListener('click'")[0];
const context = {document: {querySelector: () => ({checked: false})}, window: {}, Math};
vm.runInNewContext(`${source}\nglobalThis.api = {makePattern, fillDigits, digPuzzle, countSolutions};`, context);
const {makePattern, fillDigits, digPuzzle, countSolutions} = context.api;
function sample() {
  let pattern, solution;
  do { pattern = makePattern(); solution = fillDigits(pattern); } while (!solution);
  return {pattern, solution, dug: digPuzzle(pattern, solution)};
}

test('162-character strings round-trip and reject malformed puzzles', () => {
  const {pattern, dug} = sample();
  const code = toString(pattern, dug);
  assert.equal(code.length, 162);
  assert.equal(toString(parseString(code).pattern, parseString(code).dug), code);
  assert.equal(toString(parseString(` ${code.slice(0, 81)}\n${code.slice(81)} `).pattern, dug), code);
  assert.throws(() => parseString(code.slice(1)));
  assert.throws(() => parseString('0'.repeat(162)));
  assert.throws(() => parseString(code.slice(0, 81) + '7' + code.slice(82)));
  const shaded = pattern.flat().indexOf(true);
  assert.throws(() => parseString(code.slice(0, 81 + shaded) + '1' + code.slice(82 + shaded)));
});

test('returns one, two, or no solutions consistently with the generator', () => {
  const {pattern, dug, solution} = sample();
  const unique = findSolutions(pattern, dug);
  assert.equal(unique.length, 1);
  assert.equal(toString(pattern, unique[0]), toString(pattern, solution));
  const blank = Array.from({length: 9}, () => Array(9).fill(null));
  const multiple = findSolutions(pattern, blank);
  assert.equal(multiple.length, 2);
  assert.notEqual(toString(pattern, multiple[0]), toString(pattern, multiple[1]));
  const walk = makeWalkthrough({pattern, dug: blank, values: multiple[0]}, {allowBacktracking: false});
  assert.ok(walk.every(({step}) => step.technique !== 'Backtracking / Brute force'));
  assert.ok(walk.at(-1).values.some((value, i) => !pattern.flat()[i] && !value));
  let impossible = null;
  for (let i = 0; i < 81 && !impossible; i++) for (let digit = 1; digit <= 6 && !impossible; digit++) {
    const r = Math.floor(i / 9), c = i % 9;
    if (pattern[r][c] || dug[r][c]) continue;
    const candidate = dug.map(row => [...row]); candidate[r][c] = digit;
    try { if (findSolutions(pattern, candidate).length === 0) impossible = candidate; } catch { /* Conflicting clues are rejected before search. */ }
  }
  assert.ok(impossible, 'a locally consistent but unsolvable puzzle should be found');
  assert.equal(countSolutions(pattern, impossible), 0);
});

test('grid image export draws all 81 cells and writes a PNG', async () => {
  const {pattern, dug} = sample();
  const shading = [], lines = [], glyphs = [];
  const context = {fillRect: (...args) => shading.push(args), beginPath() {}, moveTo() {}, lineTo() {}, stroke: () => lines.push(true), fillText: (...args) => glyphs.push(args)};
  let written;
  const canvas = {getContext: () => context, toBlob: callback => callback(new Blob(['png'], {type: 'image/png'}))};
  const originalDocument = globalThis.document, originalWindow = globalThis.window;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    globalThis.document = {createElement: () => canvas};
    globalThis.window = {ClipboardItem: class {constructor(items) { this.items = items; }}};
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {write: async items => { written = items; }}}});
    await copyGridImage(pattern, dug, dug);
    assert.equal(canvas.width, 900); assert.equal(canvas.height, 900);
    assert.equal(shading.length, 28); // background plus 27 shaded cells
    assert.equal(lines.length, 20);
    assert.equal(glyphs.length, dug.flat().filter(Boolean).length);
    assert.equal(written[0].items['image/png'].type, 'image/png');
  } finally {
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else delete globalThis.navigator;
  }
});

test('simulation trial options exactly match the reference', () => {
  const html = fs.readFileSync(new URL('../dist/simulation/index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="trial-count">(.*?)<\/select>/)[1];
  assert.deepEqual([...select.matchAll(/<option value="(\d+)"/g)].map(match => Number(match[1])), [1,10,100,1000,10000,100000,1000000]);
  assert.match(select, /value="100000" selected/);
});
