import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createState, nextStep, applyStep, solveLogically, findStepByName, TECHNIQUES, techniqueScore} from '../src/techniques.ts';
import {makeWalkthrough, backtrack, sortTechniqueGroups} from '../dist/walkthrough.js';
import {TECHNIQUES as browserTechniques} from '../dist/techniques.js';

// Use the existing independent generator and solution counter as the oracle.
const source = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8').split("button.addEventListener('click'")[0];
const context = {document: {querySelector: () => ({checked: false})}, window: {}, Math};
vm.runInNewContext(`${source}\nglobalThis.api = {makePattern, makeSymmetricPattern, fillDigits, digPuzzle, countSolutions};`, context);
const {makePattern, makeSymmetricPattern, fillDigits, digPuzzle, countSolutions} = context.api;

function puzzle(symmetric) {
  let pattern, solution;
  do { pattern = symmetric ? makeSymmetricPattern() : makePattern(); solution = fillDigits(pattern); } while (!solution);
  return {pattern, solution, givens: digPuzzle(pattern, solution, symmetric)};
}

test('validates shading and givens', () => {
  const {pattern, solution} = puzzle(false);
  const state = createState(pattern, solution);
  assert.equal(state.units.length, 27);
  assert.ok(state.units.every(unit => unit.length === 6));
  assert.equal(state.peers.filter((_, i) => !state.pattern[i]).length, 54);
  const invalid = pattern.map(row => [...row]);
  invalid[0][0] = !invalid[0][0];
  assert.throws(() => createState(invalid, solution));
  const invalidGrid = solution.map(row => [...row]);
  const shaded = pattern.flat().indexOf(true);
  invalidGrid[Math.floor(shaded / 9)][shaded % 9] = 1;
  assert.throws(() => createState(pattern, invalidGrid));
});

test('logical steps are sound against independent backtracking', () => {
  for (const symmetric of [false, true]) for (let trial = 0; trial < 6; trial++) {
    const {pattern, givens, solution} = puzzle(symmetric);
    const state = createState(pattern, givens);
    let count = 0;
    for (;;) {
      const step = nextStep(state);
      if (!step) break;
      assert.ok(step.placements.length || step.eliminations.length);
      for (const {cell, digit} of step.placements) assert.equal(solution[Math.floor(cell / 9)][cell % 9], digit, step.technique);
      for (const {cell, digit} of step.eliminations) assert.notEqual(solution[Math.floor(cell / 9)][cell % 9], digit, step.technique);
      applyStep(state, step);
      assert.ok(++count < 1000, 'steps must make progress');
    }
    const remaining = Array.from({length: 9}, (_, r) => state.values.slice(r * 9, r * 9 + 9).map(v => v || null));
    assert.equal(countSolutions(pattern, remaining), 1);
  }
});

test('completed board requires no deductions', () => {
  const {pattern, solution} = puzzle(false);
  const result = solveLogically(createState(pattern, solution));
  assert.equal(result.solved, true);
  assert.equal(result.steps.length, 0);
});

test('walkthrough starts with givens and reaches the generated solution', () => {
  for (const symmetric of [false, true]) for (let trial = 0; trial < 4; trial++) {
    const {pattern, givens, solution} = puzzle(symmetric);
    const steps = makeWalkthrough({pattern, dug: givens, values: solution});
    assert.deepEqual(steps[0].values, Array.from(givens.flat(), value => value ?? 0));
    assert.deepEqual(steps.at(-1).values, Array.from(solution.flat(), value => value ?? 0));
    for (const {step} of steps.slice(1)) assert.ok(step.placements.length || step.eliminations.length);
  }
});

test('catalogue, solver priority and walkthrough table use the same ordering', () => {
  assert.deepEqual(browserTechniques, TECHNIQUES);
  assert.ok(TECHNIQUES.every((entry, i) => !i || TECHNIQUES[i - 1].score <= entry.score));
  assert.equal(TECHNIQUES.at(-1).name, 'Backtracking / Brute force');
  assert.equal(TECHNIQUES.at(-1).score, 10000);
  assert.deepEqual(sortTechniqueGroups(new Map([['Backtracking / Brute force', [1]], ['Naked Triple', [2]], ['Hidden Pair', [3]], ['Naked Single', [4]]])).map(([name]) => name), ['Naked Single', 'Hidden Pair', 'Naked Triple', 'Backtracking / Brute force']);
  for (let trial = 0; trial < 3; trial++) {
    const {pattern, givens} = puzzle(false), state = createState(pattern, givens);
    for (let n = 0; n < 12; n++) {
      const step = nextStep(state);
      if (!step) break;
      for (const technique of TECHNIQUES.filter(t => t.score < techniqueScore(step.technique))) assert.equal(findStepByName(state, technique.name), null, `${technique.name} should have taken priority over ${step.technique}`);
      applyStep(state, step);
    }
  }
});

test('fallback searches a stalled candidate state', () => {
  const {pattern} = puzzle(false);
  const state = createState(pattern, Array.from({length: 9}, () => Array(9).fill(null)));
  assert.equal(nextStep(state), null);
  const result = backtrack(state);
  assert.ok(result);
  const solved = Array.from({length: 9}, (_, r) => result.slice(r * 9, r * 9 + 9).map(value => value || null));
  assert.equal(countSolutions(pattern, solved, 2), 1);
});

test('deductions also hold for puzzles with multiple solutions', () => {
  for (let trial = 0; trial < 3; trial++) {
    const {pattern, givens} = puzzle(false);
    let kept = 0;
    const sparse = givens.map(row => row.map(value => value && kept++ < 4 ? value : null));
    assert.equal(countSolutions(pattern, sparse, 2), 2);
    const state = createState(pattern, sparse);
    for (let n = 0; n < 12; n++) {
      const step = nextStep(state);
      if (!step) break;
      for (const {cell, digit} of step.eliminations) {
        const forced = sparse.map(row => [...row]);
        forced[Math.floor(cell / 9)][cell % 9] = digit;
        assert.equal(countSolutions(pattern, forced, 1), 0, step.technique);
      }
      for (const {cell, digit} of step.placements) for (let other = 1; other <= 6; other++) {
        if (other === digit) continue;
        const forced = sparse.map(row => [...row]);
        forced[Math.floor(cell / 9)][cell % 9] = other;
        assert.equal(countSolutions(pattern, forced, 1), 0, step.technique);
      }
      applyStep(state, step);
    }
  }
});
