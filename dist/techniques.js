// Generated from src/techniques.ts by scripts/build-techniques.mjs.
/** Independent human-style solving engine for Extra Space Sudoku. */
                                       
                                  
                                                     
                                                                                                            
                                                                                                                         

const ALL = 0b111111;
const bit = (digit        ) => 1 << (digit - 1);
const digits = (mask        ) => [1, 2, 3, 4, 5, 6].filter(d => mask & bit(d));
const name = (cell        ) => `r${Math.floor(cell / 9) + 1}c${cell % 9 + 1}`;
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
function singles(s       )              {
  for (const unit of s.units) {
    const empty = unit.filter(i => !s.values[i]);
    if (empty.length === 1 && digits(s.candidates[empty[0]]).length === 1) {
      const cell = empty[0], digit = digits(s.candidates[cell])[0];
      return {technique: 'Full House', placements: [{cell, digit}], eliminations: [], explanation: `${name(cell)} is the only empty cell in its unit.`};
    }
  }
  for (let cell = 0; cell < 81; cell++) {
    const options = digits(s.candidates[cell]);
    if (options.length === 1) return {technique: 'Naked Single', placements: [{cell, digit: options[0]}], eliminations: [], explanation: `${name(cell)} has only one candidate.`};
  }
  for (const unit of s.units) for (let digit = 1; digit <= 6; digit++) {
    if (unit.some(i => s.values[i] === digit)) continue;
    const cells = unit.filter(i => s.candidates[i] & bit(digit));
    if (cells.length === 1) return {technique: 'Hidden Single', placements: [{cell: cells[0], digit}], eliminations: [], explanation: `${digit} has only one position in a unit.`};
  }
  return null;
}
function intersections(s       )              {
  for (let box = 18; box < 27; box++) for (let line = 0; line < 18; line++) {
    const intersection = s.units[box].filter(i => s.units[line].includes(i));
    if (!intersection.length) continue;
    for (let digit = 1; digit <= 6; digit++) for (const [from, to, technique] of [[box, line, 'Pointing'], [line, box, 'Claiming']]                              ) {
      const candidates = s.units[from].filter(i => s.candidates[i] & bit(digit));
      if (!candidates.length || !candidates.every(i => intersection.includes(i))) continue;
      const changes = s.units[to].filter(i => !intersection.includes(i) && (s.candidates[i] & bit(digit))).map(cell => ({cell, digit}));
      const step = elimination(technique, changes, `${digit} is confined to the intersection of a line and box.`);
      if (step) return step;
    }
  }
  return null;
}
function subsets(s       , size        )              {
  const label = ['', '', 'Pair', 'Triple', 'Quadruple'][size];
  for (const unit of s.units) {
    const open = unit.filter(i => s.candidates[i]);
    for (const cells of combinations(open, size)) {
      const mask = cells.reduce((m, i) => m | s.candidates[i], 0);
      if (digits(mask).length !== size) continue;
      const changes = open.filter(i => !cells.includes(i)).flatMap(cell => digits(s.candidates[cell] & mask).map(digit => ({cell, digit})));
      const step = elimination(`Naked ${label}`, changes, `${cells.map(name).join(', ')} share ${size} candidates in one unit.`);
      if (step) return step;
    }
    const missing = [1,2,3,4,5,6].filter(d => !unit.some(i => s.values[i] === d));
    for (const selected of combinations(missing, size)) {
      const mask = selected.reduce((m, d) => m | bit(d), 0);
      const cells = open.filter(i => s.candidates[i] & mask);
      if (cells.length !== size || selected.some(d => !cells.some(i => s.candidates[i] & bit(d)))) continue;
      const changes = cells.flatMap(cell => digits(s.candidates[cell] & ~mask).map(digit => ({cell, digit})));
      const step = elimination(`Hidden ${label}`, changes, `${selected.join(', ')} are confined to ${size} cells in one unit.`);
      if (step) return step;
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
      const covers = [...new Set(chosen.flatMap(base => s.units[(transpose ? 9 : 0) + base].filter(i => s.candidates[i] & bit(digit)).map(i => transpose ? Math.floor(i / 9) : i % 9)))];
      if (covers.length !== size) continue;
      const changes = covers.flatMap(cover => s.units[(transpose ? 0 : 9) + cover].filter(i => !chosen.includes(transpose ? i % 9 : Math.floor(i / 9)) && (s.candidates[i] & bit(digit))).map(cell => ({cell, digit})));
      const step = elimination(['', '', 'X-Wing', 'Swordfish', 'Jellyfish'][size], changes, `${digit} is restricted to ${size} crossing lines.`);
      if (step) return step;
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
      const step = elimination('XY-Wing', changes, `${name(pivot)} links wings ${name(a)} and ${name(b)}, forcing ${digit} into at least one wing.`);
      if (step) return step;
    }
  }
  return null;
}

/** Find one logical step, or null if no implemented technique applies. */
export function nextStep(state       )              {
  return singles(state) ?? intersections(state) ?? subsets(state, 2) ?? subsets(state, 3) ?? subsets(state, 4) ?? fish(state, 2) ?? fish(state, 3) ?? fish(state, 4) ?? xyWing(state);
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
