// Generated from src/techniques.ts by scripts/build-techniques.mjs.
/** Independent human-style solving engine for Extra Space Sudoku. */







// Relative per-step scores follow the reference catalogue's HoDoKu-style
// values; they are ordering weights, not calibrated Extra Space ratings.
export const TECHNIQUES = [
  {name: 'Full House', score: 4, description: 'Fill the only empty playable cell in a row, column or box.'},
  {name: 'Naked Single', score: 4, description: 'Place the only candidate left in a cell.'},
  {name: 'Hidden Single', score: 14, description: 'Place a digit that can occur in only one cell of a unit.'},
  {name: 'Pointing', score: 50, description: 'A box confines a digit to one row or column, eliminating it elsewhere on that line.'},
  {name: 'Claiming', score: 50, description: 'A row or column confines a digit to one box, eliminating it elsewhere in that box.'},
  {name: 'Naked Pair', score: 60, description: 'Two cells in a unit share two candidates, which can be removed from other cells in that unit.'},
  {name: 'Hidden Pair', score: 70, description: 'Two digits are confined to two cells of a unit, so other candidates can be removed from those cells.'},
  {name: 'Naked Triple', score: 80, description: 'Three cells in a unit share three candidates, excluding those digits from other cells in that unit.'},
  {name: 'Hidden Triple', score: 100, description: 'Three digits are confined to three cells of a unit, excluding other candidates there.'},
  {name: 'Naked Quadruple', score: 120, description: 'Four cells in a unit share four candidates, excluding those digits from the rest of the unit.'},
  {name: 'X-Wing', score: 140, description: 'A digit confined to two crossing rows and columns can be removed from the other cells on the cover lines.'},
  {name: 'Hidden Quadruple', score: 150, description: 'Four digits are confined to four cells of a unit, excluding other candidates there.'},
  {name: 'Swordfish', score: 150, description: 'A three-line fish confines a digit to three crossing lines.'},
  {name: 'Jellyfish', score: 160, description: 'A four-line fish confines a digit to four crossing lines.'},
  {name: 'XY-Wing', score: 160, description: 'A pivot and two bivalue wings force a shared wing candidate into at least one wing.'},
  {name: 'Backtracking / Brute force', score: 10000, description: 'Last resort: search remaining possibilities when no implemented logical technique applies.'},
];
export const techniqueScore = (name        )         => TECHNIQUES.find(item => item.name === name)?.score ?? Number.POSITIVE_INFINITY;

const ALL = 0b111111;
const bit = (digit        ) => 1 << (digit - 1);
const digits = (mask        ) => [1, 2, 3, 4, 5, 6].filter(d => mask & bit(d));
const name = (cell        ) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;
const unitName = (index        ) => index < 9 ? `row ${index + 1}` : index < 18 ? `column ${index - 8}` : `box ${index - 17}`;
const sharedUnits = (s       , a        , b        ) => s.units.flatMap((unit, index) => unit.includes(a) && unit.includes(b) ? [unitName(index)] : []).join(' and ');
const unitsFor = (pattern           )             => {
  const units             = [];
  for (let r = 0; r < 9; r++) units.push(Array.from({length: 9}, (_, c) => r * 9 + c).filter(i => !pattern[i]));
  for (let c = 0; c < 9; c++) units.push(Array.from({length: 9}, (_, r) => r * 9 + c).filter(i => !pattern[i]));
  for (let b = 0; b < 9; b++) units.push(Array.from({length: 9}, (_, i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + i % 3).filter(i => !pattern[i]));
  return units;
};

export function createState(pattern         , grid      )        {
  if (pattern.length !== 9 || grid.length !== 9 || pattern.some(row => row.length !== 9) || grid.some(row => row.length !== 9)) throw new Error('Expected 9 × 9 grids.');
  const spaces = pattern.flat(), values = grid.flat().map(v => v ?? 0), units = unitsFor(spaces);
  if (units.some(unit => unit.length !== 6)) throw new Error('Every row, column and box must contain exactly three shaded cells.');
  const peers = Array.from({length: 81}, () => []            );
  units.forEach(unit => unit.forEach(i => { peers[i] = [...new Set([...peers[i], ...unit.filter(j => j !== i)])]; }));
  for (let i = 0; i < 81; i++) {
    if (!Number.isInteger(values[i]) || values[i] < 0 || values[i] > 6 || (spaces[i] && values[i])) throw new Error(`Invalid value at ${name(i)}.`);
    if (values[i] && peers[i].some(j => values[j] === values[i])) throw new Error(`Conflicting value at ${name(i)}.`);
  }
  const candidates = values.map((value, i) => spaces[i] || value ? 0 : ALL & ~peers[i].reduce((mask, j) => mask | (values[j] ? bit(values[j]) : 0), 0));
  return { pattern: spaces, values, candidates, units, peers };
}

function combinations   (items     , size        )        {
  const result        = [];
  const visit = (start        , chosen     ) => {
    if (chosen.length === size) { result.push([...chosen]); return; }
    for (let i = start; i <= items.length - (size - chosen.length); i++) { chosen.push(items[i]); visit(i + 1, chosen); chosen.pop(); }
  };
  visit(0, []); return result;
}
function elimination(technique        , changes          , explanation        )              {
  return changes.length ? { technique, placements: [], eliminations: changes, explanation } : null;
}
function singles(s       , kind        )              {
  if (kind === 'Full House') {
  for (const [unitIndex, unit] of s.units.entries()) {
    const empty = unit.filter(i => !s.values[i]);
    if (empty.length === 1 && digits(s.candidates[empty[0]]).length === 1) {
      const cell = empty[0], digit = digits(s.candidates[cell])[0];
      return {technique: 'Full House', placements: [{cell, digit}], eliminations: [], evidence: [...unit], explanation: `${name(cell)} is the only empty playable cell in ${unitName(unitIndex)}.`};
    }
  }
  }
  if (kind === 'Naked Single') {
  for (let cell = 0; cell < 81; cell++) {
    const options = digits(s.candidates[cell]);
    if (options.length === 1) return {technique: 'Naked Single', placements: [{cell, digit: options[0]}], eliminations: [], evidence: [cell, ...s.peers[cell].filter(peer => s.values[peer] !== 0)], explanation: `${name(cell)} has only one candidate. Highlighted filled peers show the existing digits in its row, column and box; earlier candidate eliminations may also contribute.`};
  }
  }
  if (kind === 'Hidden Single') {
  for (const [unitIndex, unit] of s.units.entries()) for (let digit = 1; digit <= 6; digit++) {
    if (unit.some(i => s.values[i] === digit)) continue;
    const cells = unit.filter(i => s.candidates[i] & bit(digit));
    if (cells.length === 1) return {technique: 'Hidden Single', placements: [{cell: cells[0], digit}], eliminations: [], evidence: [...unit], explanation: `${digit} has only one available position in ${unitName(unitIndex)}.`};
  }
  }
  return null;
}
function intersections(s       , kind        )              {
  for (let box = 18; box < 27; box++) for (let line = 0; line < 18; line++) {
    const intersection = s.units[box].filter(i => s.units[line].includes(i));
    if (!intersection.length) continue;
    for (let digit = 1; digit <= 6; digit++) for (const [from, to, technique] of [[box, line, 'Pointing'], [line, box, 'Claiming']]                              ) {
      if (technique !== kind) continue;
      const candidates = s.units[from].filter(i => s.candidates[i] & bit(digit));
      if (!candidates.length || !candidates.every(i => intersection.includes(i))) continue;
      const changes = s.units[to].filter(i => !intersection.includes(i) && (s.candidates[i] & bit(digit))).map(cell => ({cell, digit}));
      const step = elimination(technique, changes, `In ${unitName(from)}, digit ${digit} is confined to ${candidates.map(name).join(', ')}, which also belong to ${unitName(to)}. It can therefore be removed from the rest of ${unitName(to)}.`);
      if (step) {step.evidence = [...new Set([...s.units[from], ...s.units[to]])]; return step;}
    }
  }
  return null;
}
function subsets(s       , size        , kind                    )              {
  const label = ['', '', 'Pair', 'Triple', 'Quadruple'][size];
  for (const [unitIndex, unit] of s.units.entries()) {
    const open = unit.filter(i => s.candidates[i]);
    if (kind === 'Naked') for (const cells of combinations(open, size)) {
      const mask = cells.reduce((m, i) => m | s.candidates[i], 0);
      if (digits(mask).length !== size) continue;
      const changes = open.filter(i => !cells.includes(i)).flatMap(cell => digits(s.candidates[cell] & mask).map(digit => ({cell, digit})));
      const step = elimination(`Naked ${label}`, changes, `${cells.map(name).join(', ')} contain only ${digits(mask).join(', ')} in ${unitName(unitIndex)}, so these digits can be removed from the other cells in that unit.`);
      if (step) {step.evidence = [...unit]; return step;}
    }
    const missing = [1,2,3,4,5,6].filter(d => !unit.some(i => s.values[i] === d));
    if (kind === 'Hidden') for (const selected of combinations(missing, size)) {
      const mask = selected.reduce((m, d) => m | bit(d), 0);
      const cells = open.filter(i => s.candidates[i] & mask);
      if (cells.length !== size || selected.some(d => !cells.some(i => s.candidates[i] & bit(d)))) continue;
      const changes = cells.flatMap(cell => digits(s.candidates[cell] & ~mask).map(digit => ({cell, digit})));
      const step = elimination(`Hidden ${label}`, changes, `In ${unitName(unitIndex)}, digits ${selected.join(', ')} are confined to ${cells.map(name).join(', ')}, so other candidates can be removed from these cells.`);
      if (step) {step.evidence = [...unit]; return step;}
    }
  }
  return null;
}
function fish(s       , size        )              {
  for (const transpose of [false, true]) for (let digit = 1; digit <= 6; digit++) {
    const bases = Array.from({length: 9}, (_, i) => i).filter(base => {
      const cells = s.units[(transpose ? 9 : 0) + base].filter(i => s.candidates[i] & bit(digit));
      return cells.length >= 2 && cells.length <= size;
    });
    for (const chosen of combinations(bases, size)) {
      const witnesses = chosen.flatMap(base => s.units[(transpose ? 9 : 0) + base].filter(i => s.candidates[i] & bit(digit)));
      const covers = [...new Set(witnesses.map(i => transpose ? Math.floor(i / 9) : i % 9))].sort((a, b) => a - b);
      if (covers.length !== size) continue;
      const changes = covers.flatMap(cover => s.units[(transpose ? 0 : 9) + cover].filter(i => !chosen.includes(transpose ? i % 9 : Math.floor(i / 9)) && (s.candidates[i] & bit(digit))).map(cell => ({cell, digit})));
      const baseName = transpose ? 'column' : 'row', coverName = transpose ? 'row' : 'column';
      const positions = chosen.map(base => `${baseName} ${base + 1}: ${witnesses.filter(i => (transpose ? i % 9 : Math.floor(i / 9)) === base).map(name).join(', ')}`).join('; ');
      const explanation = `For digit ${digit}, ${baseName}s ${chosen.map(i => i + 1).join(', ')} have candidates only in ${coverName}s ${covers.map(i => i + 1).join(', ')}. Candidate positions: ${positions}. Each base ${baseName} must contain ${digit} once, so these ${size} digits occupy all ${size} cover ${coverName}s. Therefore ${digit} can be removed from other cells in those ${coverName}s.`;
      const step = elimination(['', '', 'X-Wing', 'Swordfish', 'Jellyfish'][size], changes, explanation);
      if (step) { step.fish = {digit, baseDirection: baseName, bases: [...chosen], covers, witnesses}; step.evidence = [...witnesses]; return step; }
    }
  }
  return null;
}
function xyWing(s       )              {
  for (let pivot = 0; pivot < 81; pivot++) {
    const pivotDigits = digits(s.candidates[pivot]);
    if (pivotDigits.length !== 2) continue;
    const wings = s.peers[pivot].filter(i => digits(s.candidates[i]).length === 2);
    for (const [a, b] of combinations(wings, 2)) {
      const aPivot = digits(s.candidates[a] & s.candidates[pivot]);
      const bPivot = digits(s.candidates[b] & s.candidates[pivot]);
      const common = digits(s.candidates[a] & s.candidates[b] & ~s.candidates[pivot]);
      if (aPivot.length !== 1 || bPivot.length !== 1 || aPivot[0] === bPivot[0] || common.length !== 1) continue;
      const digit = common[0];
      const changes = s.peers[a].filter(i => s.peers[b].includes(i) && i !== pivot && (s.candidates[i] & bit(digit))).map(cell => ({cell, digit}));
      const links = changes.map(({cell}) => `${name(cell)} sees ${name(a)} via ${sharedUnits(s, cell, a)} and ${name(b)} via ${sharedUnits(s, cell, b)}`).join('; ');
      const step = elimination('XY-Wing', changes, `Pivot ${name(pivot)} has candidates ${pivotDigits.join('/')} and sees wing ${name(a)} (${digits(s.candidates[a]).join('/')}) via ${sharedUnits(s, pivot, a)} and wing ${name(b)} (${digits(s.candidates[b]).join('/')}) via ${sharedUnits(s, pivot, b)}. Whichever pivot digit is chosen, one wing must contain ${digit}. ${links}; therefore ${digit} can be removed from ${changes.map(change => name(change.cell)).join(', ')}.`);
      if (step) {step.evidence = [pivot, a, b]; return step;}
    }
  }
  return null;
}

/** Find a step of a specific implemented technique. */
export function findStepByName(state       , name        )              {
  const finders                                    = {
    'Full House': () => singles(state, 'Full House'), 'Naked Single': () => singles(state, 'Naked Single'), 'Hidden Single': () => singles(state, 'Hidden Single'),
    'Pointing': () => intersections(state, 'Pointing'), 'Claiming': () => intersections(state, 'Claiming'),
    'Naked Pair': () => subsets(state, 2, 'Naked'), 'Hidden Pair': () => subsets(state, 2, 'Hidden'),
    'Naked Triple': () => subsets(state, 3, 'Naked'), 'Hidden Triple': () => subsets(state, 3, 'Hidden'),
    'Naked Quadruple': () => subsets(state, 4, 'Naked'), 'Hidden Quadruple': () => subsets(state, 4, 'Hidden'),
    'X-Wing': () => fish(state, 2), 'Swordfish': () => fish(state, 3), 'Jellyfish': () => fish(state, 4), 'XY-Wing': () => xyWing(state),
  };
  return finders[name]?.() ?? null;
}

/** Find the lowest-scored available logical step. */
export function nextStep(state       )              {
  for (const technique of TECHNIQUES) {
    const step = findStepByName(state, technique.name);
    if (step) return step;
  }
  return null;
}

/** Apply a step while retaining earlier candidate eliminations. */
export function applyStep(state       , step      )       {
  for (const {cell, digit} of step.eliminations) state.candidates[cell] &= ~bit(digit);
  for (const {cell, digit} of step.placements) {
    if (!(state.candidates[cell] & bit(digit))) throw new Error('Invalid placement.');
    state.values[cell] = digit; state.candidates[cell] = 0;
    state.peers[cell].forEach(peer => { state.candidates[peer] &= ~bit(digit); });
  }
}

export function solveLogically(state       , maxSteps = 1000)                                   {
  const steps         = [];
  while (steps.length < maxSteps) {
    const step = nextStep(state);
    if (!step) break;
    applyStep(state, step); steps.push(step);
  }
  return {steps, solved: state.values.every((value, i) => state.pattern[i] || value !== 0)};
}
