import {TECHNIQUES} from '../techniques.js';

const body = document.querySelector('#technique-list');
for (const technique of TECHNIQUES) {
  const row = document.createElement('tr');
  for (const value of [technique.name, `+${technique.score}`, technique.description]) {
    const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
  }
  body.append(row);
}
