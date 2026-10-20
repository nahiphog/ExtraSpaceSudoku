import {createState, nextStep, applyStep, techniqueScore, TECHNIQUES} from './techniques.js';

const position = (cell) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;
const snapshot = (state, step) => ({values: [...state.values], candidates: [...state.candidates], step});
export function sortTechniqueGroups(groups) {
  const order = new Map(TECHNIQUES.map((technique, index) => [technique.name, index]));
  return [...groups].sort(([a], [b]) => techniqueScore(a) - techniqueScore(b) || order.get(a) - order.get(b));
}

// Arrows identify every row and column containing supporting or affected
// cells; fish also include all of their base and cover lines.
export function stepVisuals(step) {
  const supporting = [...new Set(step.evidence ?? [])];
  const affected = [...new Set([...step.placements, ...step.eliminations].map(change => change.cell))];
  const relevant = [...new Set([...supporting, ...affected])];
  const rows = new Set(relevant.map(cell => Math.floor(cell / 9)));
  const columns = new Set(relevant.map(cell => cell % 9));
  if (step.fish) {
    const rowLines = step.fish.baseDirection === 'row' ? step.fish.bases : step.fish.covers;
    const columnLines = step.fish.baseDirection === 'column' ? step.fish.bases : step.fish.covers;
    rowLines.forEach(line => rows.add(line)); columnLines.forEach(line => columns.add(line));
  }
  return {supporting, affected, rows: [...rows].sort((a,b) => a-b), columns: [...columns].sort((a,b) => a-b)};
}

// Search the current candidate state only when every logical finder stalls.
export function backtrack(state) {
  const values = [...state.values];
  function search() {
    let selected = -1, options = [];
    for (let cell = 0; cell < 81; cell++) {
      if (state.pattern[cell] || values[cell]) continue;
      const used = state.peers[cell].reduce((mask, peer) => mask | (values[peer] ? 1 << (values[peer] - 1) : 0), 0);
      const candidates = [1,2,3,4,5,6].filter(digit => (state.candidates[cell] & (1 << (digit - 1))) && !(used & (1 << (digit - 1))));
      if (!candidates.length) return false;
      if (selected < 0 || candidates.length < options.length) {selected = cell; options = candidates;}
    }
    if (selected < 0) return true;
    for (const digit of options) {values[selected] = digit; if (search()) return true; values[selected] = 0;}
    return false;
  }
  return search() ? values : null;
}

// Logical techniques are retried after every placement, including fallback.
export function makeWalkthrough({pattern, dug, values}, {allowBacktracking = true} = {}) {
  const state = createState(pattern, dug);
  const solution = values.flat();
  const steps = [snapshot(state, {technique: 'Candidates', placements: [], eliminations: [], explanation: 'Candidates are shown in each empty cell.'})];
  for (let n = 0; n < 1000; n++) {
    let step = nextStep(state);
    if (!step) {
      const cell = state.values.findIndex((value, i) => !state.pattern[i] && !value);
      if (cell < 0) break;
      if (!allowBacktracking) break;
      const found = backtrack(state);
      if (!found) throw new Error('Backtracking could not solve the current candidate state.');
      const digit = found[cell];
      if (!(state.candidates[cell] & (1 << (digit - 1)))) throw new Error('The logical path conflicts with the completed grid.');
      step = {technique: 'Backtracking / Brute force', placements: [{cell, digit}], eliminations: [], explanation: `The available techniques cannot progress; backtracking finds ${digit} at ${position(cell)} (+10000).`};
    }
    if (step.placements.some(({cell, digit}) => solution[cell] !== digit) || step.eliminations.some(({cell, digit}) => solution[cell] === digit)) throw new Error('A logical step conflicts with the completed grid.');
    applyStep(state, step);
    steps.push(snapshot(state, step));
  }
  if (state.values.some((value, i) => !state.pattern[i] && value && value !== solution[i]) || (allowBacktracking && state.values.some((value, i) => !state.pattern[i] && !value))) throw new Error('The walkthrough did not match the completed grid.');
  return steps;
}

export function mountWalkthrough(container, puzzle, {heading = 'Solution walkthrough', allowBacktracking = true} = {}) {
  const steps = makeWalkthrough(puzzle, {allowBacktracking});
  const givens = puzzle.dug.flat();
  let current = 0;
  container.replaceChildren();
  const title = document.createElement('h2'); title.id = 'walkthrough-title'; title.textContent = heading;
  const intro = document.createElement('p'); intro.className = 'walkthrough-intro'; intro.textContent = allowBacktracking ? 'Follow the deductions one step at a time. If the available techniques cannot finish, the remaining placements are marked as backtracking.' : 'This puzzle has multiple solutions. Only deductions common to all solutions are shown; the walkthrough may stop before the grid is complete.';
  const layout = document.createElement('div'); layout.className = 'walkthrough-layout';
  const boardArea = document.createElement('div'); boardArea.className = 'walkthrough-board-area';
  const boardFrame = document.createElement('div'); boardFrame.className = 'walk-grid-frame';
  const board = document.createElement('div'); board.className = 'sudoku-grid walkthrough-grid'; board.setAttribute('role', 'grid'); board.setAttribute('aria-label', 'Walkthrough grid');
  const arrows = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrows.setAttribute('viewBox', '0 0 100 100'); arrows.setAttribute('aria-hidden', 'true'); arrows.setAttribute('class', 'walk-fish-arrows');
  boardFrame.append(board, arrows);
  const description = document.createElement('p'); description.className = 'walkthrough-description'; description.setAttribute('aria-live', 'polite');
  const patternLegend = document.createElement('p'); patternLegend.className = 'walkthrough-pattern-legend';
  const counter = document.createElement('span'); counter.className = 'walkthrough-counter';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(steps.length - 1); slider.value = '0'; slider.setAttribute('aria-label', 'Walkthrough step');
  const controls = document.createElement('div'); controls.className = 'walkthrough-controls';
  const buttons = [];
  const update = () => {
    const {values, candidates, step} = steps[current];
    const visual = stepVisuals(step);
    board.replaceChildren();
    arrows.replaceChildren();
    boardFrame.className = `walk-grid-frame${visual.rows.length || visual.columns.length ? ' has-fish' : ''}`;
    if (visual.rows.length || visual.columns.length) {
      const addArrow = (direction, line) => {
        const center = 7 + (line + 0.5) * 93 / 9;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const shape = direction === 'row'
          ? `M 1 ${center} L 5.8 ${center} M 3.9 ${center - 1.5} L 5.8 ${center} L 3.9 ${center + 1.5}`
          : `M ${center} 1 L ${center} 5.8 M ${center - 1.5} 3.9 L ${center} 5.8 L ${center + 1.5} 3.9`;
        path.setAttribute('d', shape); path.setAttribute('data-direction', direction); path.setAttribute('data-line', String(line + 1)); arrows.append(path);
      };
      visual.rows.forEach(line => addArrow('row', line));
      visual.columns.forEach(line => addArrow('column', line));
    }
    values.forEach((value, i) => {
      const r = Math.floor(i / 9), c = i % 9, cell = document.createElement('div');
      const placed = step.placements.some(change => change.cell === i);
      const removed = step.eliminations.filter(change => change.cell === i);
      const fish = step.fish;
      const isBase = fish && fish.bases.includes(fish.baseDirection === 'row' ? r : c);
      const isCover = fish && fish.covers.includes(fish.baseDirection === 'row' ? c : r);
      const isWitness = fish && fish.witnesses.includes(i);
      const supporting = visual.supporting.includes(i);
      cell.className = `cell${puzzle.pattern[r][c] ? ' shaded' : ''}${c % 3 === 2 ? ' box-right' : ''}${r % 3 === 2 ? ' box-bottom' : ''}${supporting ? ' walk-evidence' : ''}${placed ? ' walk-placed' : ''}${removed.length ? ' walk-affected' : ''}${value && !givens[i] ? ' walk-solved' : ''}`;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${position(i)}: ${puzzle.pattern[r][c] ? 'shaded' : value ? String(value) : `candidates ${[1,2,3,4,5,6].filter(d => candidates[i] & (1 << (d-1))).join(', ')}`}${supporting ? ', supporting cell' : ''}${placed ? ', placed digit' : ''}${isBase ? ', fish base line' : ''}${isCover ? ', fish cover line' : ''}${isWitness ? `, fish candidate ${fish.digit}` : ''}${removed.length ? `, removed ${removed.map(change => change.digit).join(', ')}` : ''}`);
      if (value) cell.textContent = String(value);
      else if (!puzzle.pattern[r][c]) {
        const marks = document.createElement('div'); marks.className = 'walk-candidates';
        for (let digit = 1; digit <= 6; digit++) {
          const mark = document.createElement('span');
          const eliminated = removed.some(change => change.digit === digit);
          if (candidates[i] & (1 << (digit - 1)) || eliminated) mark.textContent = String(digit);
          if (eliminated) mark.className = 'walk-removed';
          else if (isWitness && digit === fish.digit) mark.className = 'walk-fish-candidate';
          marks.append(mark);
        }
        cell.append(marks);
      }
      board.append(cell);
    });
    const placements = step.placements.map(({cell, digit}) => `Place ${digit} at ${position(cell)}.`).join(' ');
    const removals = step.eliminations.map(({cell, digit}) => `${digit} from ${position(cell)}`).join(', ');
    description.textContent = `${step.technique}: ${step.explanation}${placements ? ` ${placements}` : ''}${removals ? ` Remove ${removals}.` : ''}`;
    patternLegend.textContent = visual.rows.length || visual.columns.length ? 'Red arrows: rows and columns containing highlighted cells · pale amber: supporting cells · green: placement · orange and red strike-through: elimination' : '';
    counter.textContent = `Step ${current} of ${steps.length - 1}`;
    slider.value = String(current);
    buttons[0].disabled = buttons[1].disabled = current === 0;
    buttons[2].disabled = buttons[3].disabled = current === steps.length - 1;
  };
  const actions = [['First', () => 0], ['Previous', () => Math.max(0, current - 1)], ['Next', () => Math.min(steps.length - 1, current + 1)], ['Last', () => steps.length - 1]];
  actions.forEach(([label, select]) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', () => {current = select(); update();}); buttons.push(button); controls.append(button); });
  slider.addEventListener('input', () => {current = Number(slider.value); update();});
  boardArea.append(boardFrame, description, patternLegend, slider, controls, counter);
  const breakdown = document.createElement('div'); breakdown.className = 'walkthrough-breakdown';
  const breakdownHeading = document.createElement('h3'); breakdownHeading.textContent = 'Techniques used';
  const table = document.createElement('table');
  const header = document.createElement('tr');
  for (const label of ['Technique', 'Score', 'Steps']) {const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th);}
  const thead = document.createElement('thead'); thead.append(header); const tbody = document.createElement('tbody');
  const groups = new Map();
  steps.slice(1).forEach(({step}, index) => { if (!groups.has(step.technique)) groups.set(step.technique, []); groups.get(step.technique).push(index + 1); });
  for (const [technique, numbers] of sortTechniqueGroups(groups)) {
    const row = document.createElement('tr'), label = document.createElement('td'), score = document.createElement('td'), links = document.createElement('td'); label.textContent = technique; score.textContent = `+${techniqueScore(technique)}`;
    numbers.forEach((number, index) => { if (index) links.append(document.createTextNode(', ')); const link = document.createElement('button'); link.type = 'button'; link.className = 'walk-step-link'; link.textContent = String(number); link.setAttribute('aria-label', `Go to step ${number}`); link.addEventListener('click', () => {current = number; update();}); links.append(link); });
    row.append(label, score, links); tbody.append(row);
  }
  table.append(thead, tbody); breakdown.append(breakdownHeading, table); layout.append(boardArea, breakdown); container.append(title, intro, layout); update();
  return steps;
}

if (typeof document !== 'undefined' && document.querySelector('#walkthrough') && typeof window.getCurrentPuzzle === 'function') {
  const container = document.querySelector('#walkthrough');
  const show = (puzzle) => {
    if (!puzzle) return;
    const rating = document.querySelector('#difficulty');
    try {
      const steps = mountWalkthrough(container, puzzle);
      const score = steps.slice(1).reduce((total, {step}) => total + techniqueScore(step.technique), 0);
      const searches = steps.filter(({step}) => step.technique === 'Backtracking / Brute force').length;
      if (rating) rating.textContent = `${score.toLocaleString()}${searches ? ' (backtracking)' : ''}`;
    }
    catch (error) { if (rating) rating.textContent = 'unavailable'; container.replaceChildren(); const heading = document.createElement('h2'); heading.id = 'walkthrough-title'; heading.textContent = 'Solution walkthrough'; const message = document.createElement('p'); message.textContent = `Walkthrough unavailable: ${error.message}`; container.append(heading, message); }
  };
  window.addEventListener('puzzle-generated', event => show(event.detail));
  show(window.getCurrentPuzzle());
}
