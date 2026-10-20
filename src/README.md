# Extra Space logical solver

`techniques.ts` is an independently implemented, UI-independent TypeScript
engine. It accepts a 9×9 boolean shading pattern and a 9×9 grid containing
digits 1–6 or `null`. `createState`, `nextStep`, `applyStep`, and
`solveLogically` provide a step-by-step API; `solveLogically` modifies the
supplied state. Cell indices are row-major (0–80).

Currently implemented: full house, naked and hidden singles, pointing,
claiming, naked and hidden pairs/triples/quadruples, X-Wing, Swordfish,
Jellyfish, and XY-Wing. These are independent implementations, not copied
from sudokUI. The remaining technique families in the implementation plan
have not yet been adapted or verified. The engine is not yet connected to
the site's pages; generation and uniqueness checks retain their existing
independent backtracking solvers. Difficulty ratings are not implemented.

With Node.js 24 or newer, run `node --test tests/techniques.test.mjs` to
check the logical deductions against the existing backtracking solver.
