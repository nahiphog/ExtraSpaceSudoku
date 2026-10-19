const grid = document.querySelector('#grid');
const button = document.querySelector('#generate');
const status = document.querySelector('#status');
const symmetry = document.querySelector('#symmetry');

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

function render(pattern) {
  grid.replaceChildren();
  pattern.flat().forEach((shaded, index) => {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const cell = document.createElement('div');
    cell.className = `cell${shaded ? ' shaded' : ''}${col % 3 === 2 ? ' box-right' : ''}${row % 3 === 2 ? ' box-bottom' : ''}`;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}${shaded ? ', shaded' : ', blank'}`);
    grid.append(cell);
  });
}

function generate() {
  const isSymmetric = symmetry.checked;
  render(isSymmetric ? makeSymmetricPattern() : makePattern());
  status.textContent = isSymmetric
    ? 'New rotationally symmetric arrangement generated — 27 shaded cells.'
    : 'New arrangement generated — 27 shaded cells.';
}

button.addEventListener('click', generate);
symmetry.addEventListener('change', generate);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'g' && !/input|textarea|select/i.test(document.activeElement.tagName)) generate();
});
generate();
