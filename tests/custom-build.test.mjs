import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fillSource = fs.readFileSync(new URL('../dist/fill-solver.js', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../dist/custom-build/build-worker.js', import.meta.url), 'utf8');
const pattern = '100100001001010010010001100001010001010001100100100010010001100100010010001100001'.split('').map(Number);
const grid = Array.from({length:9}, (_, r) => pattern.slice(r * 9, r * 9 + 9).map(Boolean));

test('bounded fill distinguishes a cutoff from a proven impossibility', () => {
  const context = vm.createContext({Math});
  vm.runInContext(fillSource, context);
  const result = context.ExtraSpaceFill(grid, 0);
  assert.equal(result.values, null);
  assert.equal(result.exhausted, true);
});

test('custom worker builds a unique puzzle with five clues per box', () => {
  const highlights = [];
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const white = [];
    for (let r = br * 3; r < br * 3 + 3; r++) for (let c = bc * 3; c < bc * 3 + 3; c++) if (!grid[r][c]) white.push(r * 9 + c);
    highlights.push(...white.slice(0, 5));
  }
  let seed = 1;
  const randomMath = Object.create(Math);
  randomMath.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const messages = [];
  const context = vm.createContext({Math: randomMath, self: {postMessage: message => messages.push(message)}, importScripts() {}});
  vm.runInContext(fillSource, context);
  vm.runInContext(workerSource, context);
  context.input = {pattern: grid, highlights};
  vm.runInContext('self.onmessage({data: input})', context, {timeout: 10000});
  const result = messages.find(message => message.type === 'success');
  assert.ok(result);
  assert.equal(result.givens.flat().filter(Boolean).length, 45);
  for (let i = 0; i < 81; i++) assert.equal(Boolean(result.givens[Math.floor(i / 9)][i % 9]), highlights.includes(i));
  assert.ok(messages.some(message => message.phase === 'Checking uniqueness'));
});

test('halting terminates the worker and preserves selections', () => {
  const elements = new Map();
  const makeElement = () => ({append() {}, replaceChildren() {}, setAttribute() {}, classList: {add() {}, remove() {}}});
  const document = {querySelector: selector => {if (!elements.has(selector)) elements.set(selector, makeElement()); return elements.get(selector);}, createElement: makeElement};
  let activeWorker;
  class FakeWorker {
    constructor() { activeWorker = this; }
    postMessage(data) { this.data = data; }
    terminate() { this.terminated = true; }
  }
  const context = vm.createContext({document, Math, Worker: FakeWorker, performance, setInterval: () => 1, clearInterval() {}});
  vm.runInContext(fs.readFileSync(new URL('../dist/custom-build/custom.js', import.meta.url), 'utf8'), context);
  context.testPattern = grid;
  vm.runInContext('pattern = testPattern; highlights = new Set([1, 2, 4]); render()', context);
  elements.get('#build-now').onclick();
  assert.equal(elements.get('#halt-build').disabled, false);
  assert.deepEqual(Array.from(activeWorker.data.highlights), [1, 2, 4]);
  elements.get('#halt-build').onclick();
  assert.equal(activeWorker.terminated, true);
  assert.equal(elements.get('#build-now').disabled, false);
  assert.equal(elements.get('#grid-summary').textContent, '27 spaces · 3 clues');
  assert.match(elements.get('#build-status').textContent, /selections are unchanged/);
  activeWorker.onmessage({data: {type: 'success', attempts: 1, filled: 1}});
  assert.match(elements.get('#build-status').textContent, /Stopped/);
});
