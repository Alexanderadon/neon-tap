// Zero-dependency Feature-Sliced Design import checker (complements eslint-plugin-boundaries).
// Rules:
//   1. a layer imports only from lower layers (app > pages > widgets > features > entities > shared)
//   2. slices of one layer (except shared) never import sibling slices
//   3. imports into another slice go through its public API (`@/layer/slice`), not deep paths
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('../src/', import.meta.url));
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const rank = (layer) => LAYERS.indexOf(layer);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const errors = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep);
  const [fromLayer, fromSlice] = rel;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/from\s+['"]@\/([^'"]+)['"]/g)) {
    const parts = m[1].split('/');
    const [toLayer, toSlice] = parts;
    if (!LAYERS.includes(toLayer)) continue;
    const loc = `${rel.join('/')} -> @/${m[1]}`;
    if (rank(toLayer) < rank(fromLayer)) errors.push(`upward import: ${loc}`);
    if (toLayer === fromLayer && toLayer !== 'shared' && toSlice !== fromSlice) {
      errors.push(`sibling slice import: ${loc}`);
    }
    if (toLayer !== fromLayer && toLayer !== 'shared' && parts.length > 2) {
      errors.push(`deep import (use slice public API): ${loc}`);
    }
  }
}

if (errors.length) {
  console.error('FSD violations:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log('FSD check passed');
