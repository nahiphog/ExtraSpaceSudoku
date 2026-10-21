import '../fill-solver.js';
import {ratePuzzle} from '../rating.js';

// Count only as far as two: that is enough to distinguish uniqueness.
function countSolutions(pattern, givens) {
  const values = givens.map(row => [...row]);
  const rows = Array(9).fill(0), columns = Array(9).fill(0), boxes = Array(9).fill(0), open = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (pattern[r][c]) continue;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3), d = values[r][c];
    if (d) { const bit = 1 << d; if ((rows[r] | columns[c] | boxes[b]) & bit) return 0; rows[r] |= bit; columns[c] |= bit; boxes[b] |= bit; }
    else open.push({r, c, b});
  }
  let count = 0;
  function search(cells) {
    if (count >= 2) return;
    if (!cells.length) { count++; return; }
    let bestIndex = 0, best = null;
    for (let i = 0; i < cells.length; i++) {
      const {r,c,b} = cells[i], options = [];
      for (let d = 1; d <= 6; d++) if (!((rows[r] | columns[c] | boxes[b]) & (1 << d))) options.push(d);
      if (!best || options.length < best.length) { best = options; bestIndex = i; }
      if (!options.length) return;
    }
    const {r,c,b} = cells[bestIndex], rest = cells.filter((_, i) => i !== bestIndex);
    for (const d of best) {
      const bit = 1 << d;
      rows[r] |= bit; columns[c] |= bit; boxes[b] |= bit;
      search(rest);
      rows[r] &= ~bit; columns[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= 2) return;
    }
  }
  search(open);
  return count;
}

self.onmessage = ({data: {pattern, highlights, minDifficulty, maxDifficulty}}) => {
  let attempts = 0, filled = 0;
  try {
    for (;;) {
      attempts++;
      self.postMessage({type: 'progress', phase: 'Searching for a completed grid', attempts, filled});
      const result = ExtraSpaceFill(pattern, 20000);
      if (!result.values) {
        if (!result.exhausted) {
          self.postMessage({type: 'impossible', attempts, filled});
          return;
        }
        continue;
      }
      filled++;
      self.postMessage({type: 'progress', phase: 'Checking uniqueness', attempts, filled});
      const givens = Array.from({length: 9}, () => Array(9).fill(null));
      for (const k of highlights) givens[Math.floor(k / 9)][k % 9] = result.values[Math.floor(k / 9)][k % 9];
      if (countSolutions(pattern, givens) === 1) {
        self.postMessage({type: 'progress', phase: 'Checking difficulty', attempts, filled});
        const rating = ratePuzzle(pattern, givens);
        if (rating.score >= minDifficulty && rating.score <= maxDifficulty) {
          self.postMessage({type: 'success', givens, values: result.values, rating, attempts, filled});
          return;
        }
      }
    }
  } catch (error) {
    self.postMessage({type: 'error', message: error.message, attempts, filled});
  }
};
