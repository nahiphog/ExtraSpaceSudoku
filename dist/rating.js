import {createState, nextStep, applyStep, techniqueScore} from './techniques.js';
import {backtrack} from './walkthrough.js';

// Score the deterministic logical path, searching a completion only when
// logical techniques stall. Works for either unique or non-unique puzzles.
export function ratePuzzle(pattern, givens) {
  const state = createState(pattern, givens);
  let score = 0, backtrackingSteps = 0, steps = 0;
  while (state.values.some((value, i) => !state.pattern[i] && !value)) {
    if (++steps > 1000) throw new Error('Rating exceeded the step limit.');
    let step = nextStep(state);
    if (!step) {
      const solution = backtrack(state);
      if (!solution) throw new Error('Puzzle has no solution.');
      const cell = state.values.findIndex((value, i) => !state.pattern[i] && !value);
      step = {technique: 'Backtracking / Brute force', placements: [{cell, digit: solution[cell]}], eliminations: [], explanation: ''};
      backtrackingSteps++;
    }
    score += techniqueScore(step.technique);
    applyStep(state, step);
  }
  return {score, steps, backtrackingSteps};
}

export function formatRating(rating) {
  return `${rating.score.toLocaleString()}${rating.backtrackingSteps ? ` (${rating.backtrackingSteps} backtracking ${rating.backtrackingSteps === 1 ? 'step' : 'steps'})` : ''}`;
}
