import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ratePuzzle} from '../dist/rating.js';
import {makeWalkthrough} from '../dist/walkthrough.js';
import {techniqueScore} from '../dist/techniques.js';

const fillSource = fs.readFileSync(new URL('../dist/fill-solver.js', import.meta.url), 'utf8');
const workerSource = fs.readFileSync(new URL('../dist/custom-build/build-worker.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
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
  const context = vm.createContext({Math: randomMath, self: {postMessage: message => messages.push(message)}, ratePuzzle});
  vm.runInContext(fillSource, context);
  vm.runInContext(workerSource, context);
  context.input = {pattern: grid, highlights, minDifficulty: 0, maxDifficulty: 2000};
  vm.runInContext('self.onmessage({data: input})', context, {timeout: 10000});
  const result = messages.find(message => message.type === 'success');
  assert.ok(result);
  assert.equal(result.givens.flat().filter(Boolean).length, 45);
  for (let i = 0; i < 81; i++) assert.equal(Boolean(result.givens[Math.floor(i / 9)][i % 9]), highlights.includes(i));
  assert.ok(messages.some(message => message.phase === 'Checking uniqueness'));
  assert.ok(result.rating.score >= 0 && result.rating.score <= 2000);
  const steps = makeWalkthrough({pattern:grid, dug:result.givens, values:result.values});
  assert.equal(steps.at(-1).values.filter((value, i) => !grid.flat()[i] && !value).length, 0);
  assert.equal(steps.slice(1).reduce((sum, item) => sum + techniqueScore(item.step.technique), 0), result.rating.score);
});

test('custom difficulty dropdowns match Generate options and defaults', () => {
  const main = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const custom = fs.readFileSync(new URL('../dist/custom-build/index.html', import.meta.url), 'utf8');
  for (const id of ['difficulty-min', 'difficulty-max']) {
    const dropdown = html => html.match(new RegExp(`<select id="${id}">(.*?)</select>`, 's'))[1];
    assert.equal(dropdown(custom), dropdown(main));
  }
});

test('worker retries difficulty outside the inclusive bounds', () => {
  const messages = [], scores = [299, 300];
  const highlights = grid.flat().map((shaded, i) => shaded ? -1 : i).filter(i => i >= 0);
  const context = vm.createContext({Math, self: {postMessage: message => messages.push(message)}, ratePuzzle: () => ({score: scores.shift(), backtrackingSteps: 0})});
  vm.runInContext(fillSource, context);
  vm.runInContext(workerSource, context);
  context.input = {pattern: grid, highlights, minDifficulty: 300, maxDifficulty: 300};
  vm.runInContext('self.onmessage({data: input})', context, {timeout: 10000});
  const result = messages.find(message => message.type === 'success');
  assert.equal(result.rating.score, 300);
  assert.equal(result.attempts, 2);
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
  document.querySelector('#difficulty-min').value = '0';
  document.querySelector('#difficulty-max').value = '2000';
  context.testPattern = grid;
  vm.runInContext('pattern = testPattern; highlights = new Set([1, 2, 4]); render()', context);
  elements.get('#build-now').onclick();
  assert.equal(elements.get('#halt-build').disabled, false);
  assert.deepEqual(Array.from(activeWorker.data.highlights), [1, 2, 4]);
  assert.equal(activeWorker.data.minDifficulty, 0);
  assert.equal(activeWorker.data.maxDifficulty, 2000);
  elements.get('#halt-build').onclick();
  assert.equal(activeWorker.terminated, true);
  assert.equal(elements.get('#build-now').disabled, false);
  assert.equal(elements.get('#grid-summary').textContent, '27 spaces · 3 clues');
  assert.match(elements.get('#build-status').textContent, /selections are unchanged/);
  activeWorker.onmessage({data: {type: 'success', attempts: 1, filled: 1}});
  assert.match(elements.get('#build-status').textContent, /Stopped/);
});
