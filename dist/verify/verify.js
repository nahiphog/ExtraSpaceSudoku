import {createState} from '../techniques.js';
import {mountWalkthrough} from '../walkthrough.js';

export function parseString(text) {
  const code = text.replace(/\s/g, '');
  if (!/^[01]{81}[0-6]{81}$/.test(code)) throw new Error('Use exactly 162 characters: 81 shading digits (0 or 1), followed by 81 values (0–6).');
  const pattern = Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => code[r * 9 + c] === '1'));
  const dug = Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => Number(code[81 + r * 9 + c]) || null));
  createState(pattern, dug);
  return {pattern, dug};
}
export function toString(pattern, values) {
  return pattern.flat().map(shaded => shaded ? '1' : '0').join('') + values.flat().map(value => value ?? 0).join('');
}

export async function copyGridImage(pattern, values, givens) {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context || !navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Image clipboard access is unavailable.');
  const cellSize = 96, inset = 18, gridSize = 9 * cellSize;
  context.fillStyle = '#fffdf8'; context.fillRect(0, 0, 900, 900);
  pattern.forEach((row, r) => row.forEach((shaded, c) => {
    if (shaded) { context.fillStyle = '#9ca8ad'; context.fillRect(inset + c * cellSize, inset + r * cellSize, cellSize, cellSize); }
  }));
  for (let i = 0; i <= 9; i++) {
    context.strokeStyle = i % 3 === 0 ? '#53666d' : '#9aa7a7'; context.lineWidth = i % 3 === 0 ? 4 : 1;
    context.beginPath(); context.moveTo(inset + i * cellSize, inset); context.lineTo(inset + i * cellSize, inset + gridSize); context.stroke();
    context.beginPath(); context.moveTo(inset, inset + i * cellSize); context.lineTo(inset + gridSize, inset + i * cellSize); context.stroke();
  }
  context.font = '600 52px Georgia'; context.textAlign = 'center'; context.textBaseline = 'middle';
  values.forEach((row, r) => row.forEach((value, c) => {if (value && !pattern[r][c]) { context.fillStyle = givens[r][c] ? '#273b43' : '#267491'; context.fillText(String(value), inset + (c + 0.5) * cellSize, inset + (r + 0.5) * cellSize); }}));
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create a grid image.');
  await navigator.clipboard.write([new window.ClipboardItem({'image/png': blob})]);
}

export function findSolutions(pattern, dug, limit = 2) {
  const state = createState(pattern, dug), values = [...state.values], solutions = [];
  function search() {
    if (solutions.length >= limit) return;
    let chosen = -1, options = [];
    for (let cell = 0; cell < 81; cell++) {
      if (state.pattern[cell] || values[cell]) continue;
      const used = state.peers[cell].reduce((mask, peer) => mask | (values[peer] ? 1 << values[peer] : 0), 0);
      const available = [1,2,3,4,5,6].filter(digit => !(used & (1 << digit)));
      if (!available.length) return;
      if (chosen < 0 || available.length < options.length) {chosen = cell; options = available;}
    }
    if (chosen < 0) { solutions.push(Array.from({length:9}, (_, r) => values.slice(r * 9, r * 9 + 9).map(value => value || null))); return; }
    for (const digit of options) { values[chosen] = digit; search(); values[chosen] = 0; if (solutions.length >= limit) return; }
  }
  search(); return solutions;
}

if (typeof document !== 'undefined') {
  const $ = selector => document.querySelector(selector);
  const input = $('#puzzle-string'), entry = $('#entry-grid'), status = $('#verify-status'), results = $('#verify-results');
  const shadeButton = $('#space-mode'), digitButton = $('#digit-mode'), help = $('#entry-help'), verify = $('#verify-puzzle');
  const cells = [], spaces = Array(81).fill(false);
  let mode = 'spaces';
  function modeChanged() {
    shadeButton.setAttribute('aria-pressed', String(mode === 'spaces')); digitButton.setAttribute('aria-pressed', String(mode === 'digits'));
    help.textContent = mode === 'spaces' ? 'Click cells to toggle their shading.' : 'Enter digits 1–6 in the white cells; leave other cells empty.';
    cells.forEach((cell, i) => { cell.readOnly = mode === 'spaces' || spaces[i]; });
  }
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('input'), r = Math.floor(i / 9), c = i % 9;
    cell.className = `entry-cell${c % 3 === 2 ? ' box-right' : ''}${r % 3 === 2 ? ' box-bottom' : ''}`;
    cell.inputMode = 'numeric'; cell.maxLength = 1; cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}`); cell.setAttribute('role', 'gridcell');
    cell.addEventListener('click', () => { if (mode !== 'spaces') return; spaces[i] = !spaces[i]; cell.classList.toggle('shaded', spaces[i]); if (spaces[i]) cell.value = ''; cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}${spaces[i] ? ', shaded' : ''}`); });
    cell.addEventListener('input', () => {cell.value = cell.value.replace(/[^1-6]/g, '').slice(0, 1);});
    cell.addEventListener('keydown', event => { const offset = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9}[event.key]; if (offset !== undefined && i + offset >= 0 && i + offset < 81) {event.preventDefault(); cells[i + offset].focus();} });
    cells.push(cell); entry.append(cell);
  }
  shadeButton.addEventListener('click', () => {mode = 'spaces'; modeChanged();});
  digitButton.addEventListener('click', () => {mode = 'digits'; modeChanged();});
  modeChanged();
  $('#clear-input').addEventListener('click', () => { input.value = ''; spaces.fill(false); cells.forEach((cell, i) => {cell.value = ''; cell.classList.remove('shaded'); cell.setAttribute('aria-label', `Row ${Math.floor(i / 9) + 1}, column ${i % 9 + 1}`);}); mode = 'spaces'; modeChanged(); results.replaceChildren(); status.textContent = 'Input cleared.'; });
  $('#paste-clipboard').addEventListener('click', async () => { try { const value = (await navigator.clipboard.readText()).replace(/\s/g, ''); parseString(value); input.value = value; results.replaceChildren(); status.textContent = 'Puzzle pasted from clipboard.'; } catch (error) { status.textContent = `Could not paste puzzle: ${error.message}. You can paste into the string field instead.`; } });
  function card(title, pattern, values, givens, alternate) {
    const section = document.createElement('section'); section.className = 'verify-card';
    const heading = document.createElement('h2'); heading.textContent = title;
    const grid = document.createElement('div'); grid.className = 'sudoku-grid'; grid.setAttribute('role', 'grid'); grid.setAttribute('aria-label', title);
    pattern.flat().forEach((shaded, i) => {
      const r = Math.floor(i / 9), c = i % 9, value = values[r][c], cell = document.createElement('div');
      cell.className = `cell${shaded ? ' shaded' : ''}${c % 3 === 2 ? ' box-right' : ''}${r % 3 === 2 ? ' box-bottom' : ''}${value && !givens[r][c] ? ' solved' : ''}${alternate && value !== alternate[r][c] ? ' different' : ''}`;
      cell.setAttribute('role', 'gridcell'); cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}: ${shaded ? 'shaded' : value || 'empty'}`); if (value) cell.textContent = String(value); grid.append(cell);
    });
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'result-copy'; copy.textContent = 'Copy 162-string';
    copy.addEventListener('click', async () => {try {await navigator.clipboard.writeText(toString(pattern, values)); status.textContent = `${title} copied to clipboard.`;} catch {status.textContent = 'Clipboard access was unavailable.';}});
    const image = document.createElement('button'); image.type = 'button'; image.className = 'result-copy'; image.textContent = 'Copy image';
    image.addEventListener('click', async () => {try {await copyGridImage(pattern, values, givens); status.textContent = `${title} image copied to clipboard.`;} catch {status.textContent = 'Image clipboard access was unavailable in this browser.';}});
    const actions = document.createElement('div'); actions.className = 'result-actions'; actions.append(copy, image);
    section.append(heading, grid, actions); return section;
  }
  verify.addEventListener('click', () => {
    results.replaceChildren(); let puzzle;
    try {
      if (input.value.trim()) puzzle = parseString(input.value);
      else {
        const pattern = Array.from({length:9}, (_, r) => spaces.slice(r * 9, r * 9 + 9));
        const dug = Array.from({length:9}, (_, r) => cells.slice(r * 9, r * 9 + 9).map(cell => Number(cell.value) || null));
        createState(pattern, dug); puzzle = {pattern, dug};
      }
    } catch (error) {status.textContent = error.message; return;}
    verify.disabled = true; status.textContent = 'Checking solutions…';
    requestAnimationFrame(() => {
      try {
        const solutions = findSolutions(puzzle.pattern, puzzle.dug);
        if (!solutions.length) {status.textContent = 'This puzzle has no solution.'; return;}
        results.append(card('Puzzle', puzzle.pattern, puzzle.dug, puzzle.dug));
        if (solutions.length === 1) {
          status.textContent = 'This puzzle has exactly one solution.';
          results.append(card('Completed grid', puzzle.pattern, solutions[0], puzzle.dug));
          const walk = document.createElement('section'); walk.className = 'walkthrough-panel'; results.append(walk);
          try {mountWalkthrough(walk, {...puzzle, values: solutions[0]});} catch {walk.textContent = 'A verified walkthrough is unavailable for this puzzle.';}
        } else {
          status.textContent = 'This puzzle has multiple solutions. Differences are highlighted in orange.';
          results.append(card('Solution 1', puzzle.pattern, solutions[0], puzzle.dug, solutions[1]), card('Solution 2', puzzle.pattern, solutions[1], puzzle.dug, solutions[0]));
          const walk = document.createElement('section'); walk.className = 'walkthrough-panel'; results.append(walk);
          try {mountWalkthrough(walk, {...puzzle, values: solutions[0]}, {heading: 'Walkthrough for solution 1', allowBacktracking: false});} catch {walk.textContent = 'A verified logical walkthrough is unavailable for this puzzle.';}
        }
      } catch (error) {status.textContent = `Unable to verify: ${error.message}`;} finally {verify.disabled = false;}
    });
  });
}
