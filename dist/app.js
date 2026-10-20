const puzzleGrid = document.querySelector('#puzzle-grid');
const solutionGrid = document.querySelector('#solution-grid');
const button = document.querySelector('#generate');
const status = document.querySelector('#status');
const symmetry = document.querySelector('#symmetry');
const clueCount = document.querySelector('#clue-count');
const elapsed = document.querySelector('#elapsed');
const remaining = document.querySelector('#remaining');
let currentPuzzle = null;

function shuffled(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A 3-regular bipartite graph for each band: rows -> columns.
// It preserves three grey cells in each row and each column; assigning
// the three row selections to different stacks also gives every 3x3 box three.
function makePattern() {
  const pattern = Array.from({ length: 9 }, () => Array(9).fill(false));
  for (let band = 0; band < 3; band++) {
    const stackOrders = [shuffled([0, 1, 2]), shuffled([0, 1, 2]), shuffled([0, 1, 2])];
    const rowOrder = shuffled([0, 1, 2]);
    const stackPermutations = shuffled([[0, 1, 2], [1, 2, 0], [2, 0, 1]]);
    for (let localRow = 0; localRow < 3; localRow++) {
      const row = band * 3 + localRow;
      for (let stack = 0; stack < 3; stack++) {
        const choice = stackOrders[stack][stackPermutations[rowOrder[localRow]][stack]];
        pattern[row][stack * 3 + choice] = true;
      }
    }
  }
  return pattern;
}

// A cyclic construction with a mirrored row and stack rule. It produces three
// cells in every row, column and box, while a cell at (r, c) always has a mate
// at (8-r, 8-c). The centre cell is necessarily shaded to make the odd total.
function makeSymmetricPattern() {
  const pattern = Array.from({ length: 9 }, () => Array(9).fill(false));
  const mirrorSum = Math.floor(Math.random() * 3);
  const b0 = Math.floor(Math.random() * 3);
  const stackOffsets = [b0, (mirrorSum * 2) % 3, (mirrorSum - b0 + 3) % 3];
  const rowOffsets = Array(9);
  const complement = (2 - mirrorSum + 3) % 3;
  const topBand = shuffled([0, 1, 2]);

  for (let row = 0; row < 3; row++) {
    rowOffsets[row] = topBand[row];
    rowOffsets[8 - row] = (complement - topBand[row] + 3) % 3;
  }

  const centreOffset = ((complement * 2) % 3 + 3) % 3;
  const middleChoices = shuffled([0, 1, 2].filter((value) => value !== centreOffset));
  rowOffsets[3] = middleChoices[0];
  rowOffsets[4] = centreOffset;
  rowOffsets[5] = middleChoices[1];

  for (let row = 0; row < 9; row++) {
    for (let stack = 0; stack < 3; stack++) {
      const localColumn = (rowOffsets[row] + stackOffsets[stack]) % 3;
      pattern[row][stack * 3 + localColumn] = true;
    }
  }
  return pattern;
}

function boxIndex(row, column) {
  return Math.floor(row / 3) * 3 + Math.floor(column / 3);
}

function digitsFromMask(mask) {
  return shuffled([1, 2, 3, 4, 5, 6].filter((digit) => !(mask & (1 << digit))));
}

// Randomized minimum-remaining-values search. A white cell is assigned only
// when its digit remains unique in its row, column, and 3×3 outlined region.
function fillDigits(pattern) {
  const values = Array.from({ length: 9 }, () => Array(9).fill(null));
  const rowUsed = Array(9).fill(0);
  const columnUsed = Array(9).fill(0);
  const boxUsed = Array(9).fill(0);
  const cells = [];

  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 9; column++) {
      if (!pattern[row][column]) cells.push({ row, column, box: boxIndex(row, column) });
    }
  }

  function solve(remaining) {
    if (!remaining.length) return true;
    let bestCount = 7;
    let bestIndexes = [];
    const candidates = new Map();

    remaining.forEach((cell, index) => {
      const used = rowUsed[cell.row] | columnUsed[cell.column] | boxUsed[cell.box];
      const options = digitsFromMask(used);
      candidates.set(index, options);
      if (options.length < bestCount) {
        bestCount = options.length;
        bestIndexes = [index];
      } else if (options.length === bestCount) {
        bestIndexes.push(index);
      }
    });

    if (!bestCount) return false;
    const chosenIndex = bestIndexes[Math.floor(Math.random() * bestIndexes.length)];
    const cell = remaining[chosenIndex];
    const next = remaining.filter((_, index) => index !== chosenIndex);

    for (const digit of candidates.get(chosenIndex)) {
      const flag = 1 << digit;
      values[cell.row][cell.column] = digit;
      rowUsed[cell.row] |= flag;
      columnUsed[cell.column] |= flag;
      boxUsed[cell.box] |= flag;
      if (solve(next)) return true;
      values[cell.row][cell.column] = null;
      rowUsed[cell.row] &= ~flag;
      columnUsed[cell.column] &= ~flag;
      boxUsed[cell.box] &= ~flag;
    }
    return false;
  }

  return solve(cells) ? values : null;
}

function makePuzzle() {
  // Regenerate the shading if an unusual layout has no compatible 1–6 fill.
  for (let attempt = 0; attempt < 100; attempt++) {
    const pattern = symmetry.checked ? makeSymmetricPattern() : makePattern();
    const values = fillDigits(pattern);
    if (values) return { pattern, values };
  }
  throw new Error('Could not make a valid Extra Space Sudoku.');
}

function toExtraSudokuSpace(pattern, values) {
  const spaces = pattern.flat().map((shaded) => shaded ? '1' : '0').join('');
  const givens = values.flat().map((value) => value ?? '0').join('');
  return spaces + givens;
}

async function copyCurrent(kind) {
  if (!currentPuzzle) return;
  const values = kind === 'dug' ? currentPuzzle.dug : currentPuzzle.values;
  await navigator.clipboard.writeText(toExtraSudokuSpace(currentPuzzle.pattern, values));
  status.textContent = `${kind === 'dug' ? 'Dug puzzle' : 'Completed grid'} copied as a 162-character ExtraSudokuSpace string.`;
}

function countSolutions(pattern, givens, limit = 2) {
  const rowUsed = Array(9).fill(0);
  const columnUsed = Array(9).fill(0);
  const boxUsed = Array(9).fill(0);
  const cells = [];

  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 9; column++) {
      if (pattern[row][column]) continue;
      const box = boxIndex(row, column);
      const digit = givens[row][column];
      if (digit) {
        const flag = 1 << digit;
        if ((rowUsed[row] | columnUsed[column] | boxUsed[box]) & flag) return 0;
        rowUsed[row] |= flag;
        columnUsed[column] |= flag;
        boxUsed[box] |= flag;
      } else {
        cells.push({ row, column, box });
      }
    }
  }

  let solutions = 0;
  function search(openCells) {
    if (solutions >= limit) return;
    if (!openCells.length) { solutions++; return; }
    let bestIndex = -1;
    let bestOptions = null;
    openCells.forEach((cell, index) => {
      const options = digitsFromMask(rowUsed[cell.row] | columnUsed[cell.column] | boxUsed[cell.box]);
      if (!bestOptions || options.length < bestOptions.length) { bestIndex = index; bestOptions = options; }
    });
    if (!bestOptions.length) return;
    const cell = openCells[bestIndex];
    const next = openCells.filter((_, index) => index !== bestIndex);
    for (const digit of bestOptions) {
      const flag = 1 << digit;
      rowUsed[cell.row] |= flag; columnUsed[cell.column] |= flag; boxUsed[cell.box] |= flag;
      search(next);
      rowUsed[cell.row] &= ~flag; columnUsed[cell.column] &= ~flag; boxUsed[cell.box] &= ~flag;
      if (solutions >= limit) return;
    }
  }
  search(cells);
  return solutions;
}

function digPuzzle(pattern, solution, symmetric = false) {
  const givens = solution.map((row) => row.map((digit) => digit));
  const cells = shuffled(Array.from({ length: 81 }, (_, index) => index).filter((index) => !pattern[Math.floor(index / 9)][index % 9] && (!symmetric || index < 80 - index)));
  for (const index of cells) {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const digit = givens[row][column];
    const pairedRow = 8 - row;
    const pairedColumn = 8 - column;
    const pairedDigit = symmetric ? givens[pairedRow][pairedColumn] : null;
    givens[row][column] = null;
    if (symmetric) givens[pairedRow][pairedColumn] = null;
    if (countSolutions(pattern, givens) !== 1) {
      givens[row][column] = digit;
      if (symmetric) givens[pairedRow][pairedColumn] = pairedDigit;
    }
  }
  return givens;
}

function render(grid, pattern, values, isDug = false) {
  grid.replaceChildren();
  pattern.flat().forEach((shaded, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const cell = document.createElement('div');
    const empty = !shaded && values[row][col] === null;
    cell.className = `cell${shaded ? ' shaded' : ''}${empty ? ' empty' : ''}${col % 3 === 2 ? ' box-right' : ''}${row % 3 === 2 ? ' box-bottom' : ''}`;
    cell.setAttribute('role', 'gridcell');
    if (!shaded && !empty) cell.textContent = values[row][col];
    cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}${shaded ? ', shaded' : empty ? ', empty' : `, ${values[row][col]}`}`);
    grid.append(cell);
  });
}

function generate() {
  const started = performance.now();
  const isSymmetric = symmetry.checked;
  const { pattern, values } = makePuzzle();
  const dug = digPuzzle(pattern, values, isSymmetric);
  currentPuzzle = { pattern, values, dug };
  const clues = dug.flat().filter((value) => value !== null).length;
  render(puzzleGrid, pattern, dug, true);
  render(solutionGrid, pattern, values);
  clueCount.textContent = `${clues} clues`;
  remaining.textContent = `${clues} cells`;
  elapsed.textContent = `${(performance.now() - started).toFixed(1)} ms`;
  status.textContent = isSymmetric
    ? 'Unique rotationally symmetric puzzle generated.'
    : 'Unique puzzle generated.';
}

button.addEventListener('click', generate);
symmetry.addEventListener('change', generate);
document.querySelector('#copy-dug').addEventListener('click', () => copyCurrent('dug'));
document.querySelector('#copy-solution').addEventListener('click', () => copyCurrent('solution'));
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'g' && !/input|textarea|select/i.test(document.activeElement.tagName)) generate();
});
generate();
