// Shared randomized solver for filling the white cells of an Extra Space grid.
// A finite node budget makes a failed attempt distinct from a proof of impossibility.
globalThis.ExtraSpaceFill = function fillExtraSpace(pattern, nodeLimit = Infinity) {
  const values = Array.from({length: 9}, () => Array(9).fill(null));
  const rows = Array(9).fill(0), columns = Array(9).fill(0), boxes = Array(9).fill(0);
  const cells = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (!pattern[r][c]) cells.push({r, c, b: Math.floor(r / 3) * 3 + Math.floor(c / 3)});
  }
  let nodes = 0, exhausted = false;
  function search(open) {
    if (++nodes > nodeLimit) { exhausted = true; return false; }
    if (!open.length) return true;
    let best = [], min = 7;
    for (let i = 0; i < open.length; i++) {
      const {r, c, b} = open[i], used = rows[r] | columns[c] | boxes[b];
      let count = 0;
      for (let d = 1; d <= 6; d++) if (!(used & (1 << d))) count++;
      if (count < min) { min = count; best = [i]; }
      else if (count === min) best.push(i);
    }
    if (!min) return false;
    const index = best[Math.floor(Math.random() * best.length)];
    const {r, c, b} = open[index], next = open.filter((_, i) => i !== index);
    const digits = [];
    for (let d = 1; d <= 6; d++) if (!((rows[r] | columns[c] | boxes[b]) & (1 << d))) digits.push(d);
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    for (const d of digits) {
      const bit = 1 << d;
      values[r][c] = d; rows[r] |= bit; columns[c] |= bit; boxes[b] |= bit;
      if (search(next)) return true;
      values[r][c] = null; rows[r] &= ~bit; columns[c] &= ~bit; boxes[b] &= ~bit;
      if (exhausted) return false;
    }
    return false;
  }
  const solved = search(cells);
  return {values: solved ? values : null, exhausted, nodes};
};
