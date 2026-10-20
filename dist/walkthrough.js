import {createState, nextStep, applyStep} from './techniques.js';

const position = (cell) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;
const snapshot = (state, step) => ({values: [...state.values], candidates: [...state.candidates], step});

// Logical techniques are tried first. Only a previously verified unique
// solution is used as an explicitly labelled backtracking fallback.
export function makeWalkthrough({pattern, dug, values}) {
  const state = createState(pattern, dug);
  const solution = values.flat();
  const steps = [snapshot(state, {technique: 'Candidates', placements: [], eliminations: [], explanation: 'Candidates are shown in each empty cell.'})];
  for (let n = 0; n < 1000; n++) {
    let step = nextStep(state);
    if (!step) {
      const cell = state.values.findIndex((value, i) => !state.pattern[i] && !value);
      if (cell < 0) break;
      const digit = solution[cell];
      if (!(state.candidates[cell] & (1 << (digit - 1)))) throw new Error('The logical path conflicts with the completed grid.');
      step = {technique: 'Backtracking', placements: [{cell, digit}], eliminations: [], explanation: `The available techniques cannot progress; backtracking finds ${digit} at ${position(cell)}.`};
    }
    if (step.placements.some(({cell, digit}) => solution[cell] !== digit) || step.eliminations.some(({cell, digit}) => solution[cell] === digit)) throw new Error('A logical step conflicts with the completed grid.');
    applyStep(state, step);
    steps.push(snapshot(state, step));
  }
  if (state.values.some((value, i) => !state.pattern[i] && value !== solution[i])) throw new Error('The walkthrough did not reach the completed grid.');
  return steps;
}

export function mountWalkthrough(container, puzzle) {
  const steps = makeWalkthrough(puzzle);
  const givens = puzzle.dug.flat();
  let current = 0;
  container.replaceChildren();
  const title = document.createElement('h2'); title.id = 'walkthrough-title'; title.textContent = 'Solution walkthrough';
  const intro = document.createElement('p'); intro.className = 'walkthrough-intro'; intro.textContent = 'Follow the deductions one step at a time. If the available techniques cannot finish, the remaining placements are marked as backtracking.';
  const layout = document.createElement('div'); layout.className = 'walkthrough-layout';
  const boardArea = document.createElement('div'); boardArea.className = 'walkthrough-board-area';
  const board = document.createElement('div'); board.className = 'sudoku-grid walkthrough-grid'; board.setAttribute('role', 'grid'); board.setAttribute('aria-label', 'Walkthrough grid');
  const description = document.createElement('p'); description.className = 'walkthrough-description'; description.setAttribute('aria-live', 'polite');
  const counter = document.createElement('span'); counter.className = 'walkthrough-counter';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(steps.length - 1); slider.value = '0'; slider.setAttribute('aria-label', 'Walkthrough step');
  const controls = document.createElement('div'); controls.className = 'walkthrough-controls';
  const buttons = [];
  const update = () => {
    const {values, candidates, step} = steps[current];
    board.replaceChildren();
    values.forEach((value, i) => {
      const r = Math.floor(i / 9), c = i % 9, cell = document.createElement('div');
      const placed = step.placements.some(change => change.cell === i);
      const removed = step.eliminations.filter(change => change.cell === i);
      cell.className = `cell${puzzle.pattern[r][c] ? ' shaded' : ''}${c % 3 === 2 ? ' box-right' : ''}${r % 3 === 2 ? ' box-bottom' : ''}${placed ? ' walk-placed' : ''}${removed.length ? ' walk-affected' : ''}${value && !givens[i] ? ' walk-solved' : ''}`;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${position(i)}: ${puzzle.pattern[r][c] ? 'shaded' : value ? String(value) : `candidates ${[1,2,3,4,5,6].filter(d => candidates[i] & (1 << (d-1))).join(', ')}`}`);
      if (value) cell.textContent = String(value);
      else if (!puzzle.pattern[r][c]) {
        const marks = document.createElement('div'); marks.className = 'walk-candidates';
        for (let digit = 1; digit <= 6; digit++) {
          const mark = document.createElement('span');
          const eliminated = removed.some(change => change.digit === digit);
          if (candidates[i] & (1 << (digit - 1)) || eliminated) mark.textContent = String(digit);
          if (eliminated) mark.className = 'walk-removed';
          marks.append(mark);
        }
        cell.append(marks);
      }
      board.append(cell);
    });
    const placements = step.placements.map(({cell, digit}) => `Place ${digit} at ${position(cell)}.`).join(' ');
    const removals = step.eliminations.map(({cell, digit}) => `${digit} from ${position(cell)}`).join(', ');
    description.textContent = `${step.technique}: ${step.explanation}${placements ? ` ${placements}` : ''}${removals ? ` Remove ${removals}.` : ''}`;
    counter.textContent = `Step ${current} of ${steps.length - 1}`;
    slider.value = String(current);
    buttons[0].disabled = buttons[1].disabled = current === 0;
    buttons[2].disabled = buttons[3].disabled = current === steps.length - 1;
  };
  const actions = [['First', () => 0], ['Previous', () => Math.max(0, current - 1)], ['Next', () => Math.min(steps.length - 1, current + 1)], ['Last', () => steps.length - 1]];
  actions.forEach(([label, select]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', () => {current = select(); update();}); buttons.push(button); controls.append(button); });
  slider.addEventListener('input', () => {current = Number(slider.value); update();});
  boardArea.append(board, description, slider, controls, counter);
  const breakdown = document.createElement('div'); breakdown.className = 'walkthrough-breakdown';
  const heading = document.createElement('h3'); heading.textContent = 'Techniques used';
  const table = document.createElement('table');
  const header = document.createElement('tr');
  for (const label of ['Technique', 'Steps']) {const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th);}
  const thead = document.createElement('thead'); thead.append(header); const tbody = document.createElement('tbody');
  const groups = new Map();
  steps.slice(1).forEach(({step}, index) => { if (!groups.has(step.technique)) groups.set(step.technique, []); groups.get(step.technique).push(index + 1); });
  for (const [technique, numbers] of groups) {
    const row = document.createElement('tr'), label = document.createElement('td'), links = document.createElement('td'); label.textContent = technique;
    numbers.forEach((number, index) => { if (index) links.append(document.createTextNode(', ')); const link = document.createElement('button'); link.type = 'button'; link.className = 'walk-step-link'; link.textContent = String(number); link.setAttribute('aria-label', `Go to step ${number}`); link.addEventListener('click', () => {current = number; update();}); links.append(link); });
    row.append(label, links); tbody.append(row);
  }
  table.append(thead, tbody); breakdown.append(heading, table); layout.append(boardArea, breakdown); container.append(title, intro, layout); update();
}

if (typeof document !== 'undefined') {
  const container = document.querySelector('#walkthrough');
  const show = (puzzle) => {
    if (!puzzle) return;
    try { mountWalkthrough(container, puzzle); }
    catch (error) { container.replaceChildren(); const heading = document.createElement('h2'); heading.id = 'walkthrough-title'; heading.textContent = 'Solution walkthrough'; const message = document.createElement('p'); message.textContent = `Walkthrough unavailable: ${error.message}`; container.append(heading, message); }
  };
  window.addEventListener('puzzle-generated', event => show(event.detail));
  show(window.getCurrentPuzzle());
}
