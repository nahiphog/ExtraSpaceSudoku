import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseString, toString, findSolutions, copyGridImage} from '../dist/verify/verify.js';
import {makeWalkthrough, mountWalkthrough, stepVisuals} from '../dist/walkthrough.js';

const source = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8').split("button.addEventListener('click'")[0];
const context = {document: {querySelector: () => ({checked: false})}, window: {}, Math};
vm.runInNewContext(fs.readFileSync(new URL('../dist/fill-solver.js', import.meta.url), 'utf8'), context);
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

test('reported Swordfish identifies and highlights its actual rows, columns, and candidates', () => {
  const code = '010001100100100001001010010001100100010001001100010010010010001100100010001001100000600000000005300000000406010000040000000000006300000000000000000000100200000000';
  const puzzle = parseString(code), solutions = findSolutions(puzzle.pattern, puzzle.dug);
  assert.equal(solutions.length, 1);
  const steps = makeWalkthrough({...puzzle, values: solutions[0]});
  const step = steps[9].step;
  assert.equal(step.technique, 'Swordfish');
  assert.deepEqual(step.fish, {digit: 1, baseDirection: 'row', bases: [1,4,8], covers: [3,4,7], witnesses: [13,16,39,40,43,75,76]});
  assert.match(step.explanation, /rows 2, 5, 9.*columns 4, 5, 8/);
  assert.match(step.explanation, /r2c5.*r5c4.*r9c5/);
  assert.deepEqual(step.eliminations.map(({cell}) => cell).sort((a,b) => a-b), [4,7,21]);

  class Element {
    constructor(tag) {this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.textContent = ''; this.className = '';}
    append(...children) {this.children.push(...children);}
    replaceChildren(...children) {this.children = [...children];}
    setAttribute(key, value) {this.attributes[key] = value;}
    addEventListener(name, handler) {this.listeners[name] = handler;}
  }
  const oldDocument = globalThis.document;
  try {
    globalThis.document = {createElement: tag => new Element(tag), createElementNS: (_namespace, tag) => new Element(tag), createTextNode: text => ({textContent:text})};
    const container = new Element('section');
    mountWalkthrough(container, {...puzzle, values: solutions[0]});
    const area = container.children[2].children[0], frame = area.children[0], board = frame.children[0], arrows = frame.children[1], slider = area.children[3];
    slider.value = '9'; slider.listeners.input();
    assert.equal(board.children.length, 81);
    assert.match(frame.className, /has-fish/);
    assert.deepEqual(arrows.children.map(arrow => [arrow.attributes['data-direction'], arrow.attributes['data-line']]), [['row','1'],['row','2'],['row','3'],['row','5'],['row','9'],['column','4'],['column','5'],['column','8']]);
    assert.doesNotMatch(board.children[13].className, /walk-fish-base|walk-fish-cover/);
    assert.match(board.children[13].attributes['aria-label'], /fish candidate 1/);
    assert.match(board.children[4].className, /walk-affected/);
    assert.match(area.children[2].textContent, /Red arrows: rows and columns containing highlighted cells/);
    slider.value = '0'; slider.listeners.input();
    assert.equal(arrows.children.length, 0);
    assert.doesNotMatch(frame.className, /has-fish/);
  } finally {if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;}
});

test('XY-Wing walkthrough marks the pivot, wings, target, and their lines', () => {
  const code = '010001100100010001001100010001100010100010001010001100010001100100010001001100010003000010000000200100000000030000000001000600000000050000000002006000000020000300';
  const puzzle = parseString(code), solutions = findSolutions(puzzle.pattern, puzzle.dug);
  assert.equal(solutions.length, 1);
  const steps = makeWalkthrough({...puzzle, values: solutions[0]});
  const step = steps[24].step;
  assert.equal(step.technique, 'XY-Wing');
  assert.deepEqual(step.evidence, [72,77,27]);
  assert.deepEqual(step.eliminations, [{cell:32, digit:6}]);
  assert.deepEqual(stepVisuals(step), {supporting:[72,77,27], affected:[32], rows:[3,8], columns:[0,5]});
  assert.match(step.explanation, /r9c1.*r9c6.*row 9.*r4c1.*column 1/);
  assert.match(step.explanation, /r4c6.*column 6.*row 4/);
  for (const {step: current} of steps.slice(1)) {
    const visual = stepVisuals(current);
    assert.ok(visual.rows.length && visual.columns.length, `${current.technique} must identify its affected lines`);
    for (const change of [...current.placements, ...current.eliminations]) assert.ok(visual.affected.includes(change.cell));
    if (current.technique !== 'Backtracking / Brute force') assert.ok(visual.supporting.length, `${current.technique} must identify supporting cells`);
  }
});
