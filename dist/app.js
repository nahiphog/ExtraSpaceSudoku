const grid = document.querySelector('#grid');
const button = document.querySelector('#generate');
const status = document.querySelector('#status');

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
  render(makePattern());
  status.textContent = 'New arrangement generated — 27 shaded cells.';
}

button.addEventListener('click', generate);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'g' && !/input|textarea|select/i.test(document.activeElement.tagName)) generate();
});
generate();
