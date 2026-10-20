// Generate the browser module from the TypeScript source using Node's type stripper.
import {stripTypeScriptTypes} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/techniques.ts', import.meta.url), 'utf8');
const output = stripTypeScriptTypes(source, {mode: 'strip'});
await writeFile(new URL('../dist/techniques.js', import.meta.url), `// Generated from src/techniques.ts by scripts/build-techniques.mjs.\n${output}`);
