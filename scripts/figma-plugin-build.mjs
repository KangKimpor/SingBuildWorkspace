// Builds a local Figma development plugin from docs/figma/*.js.
//
// The MCP `use_figma` tool is capped by the Figma plan, so the same library and
// screen files are bundled into figma-plugin/code.js instead. Run the plugin once
// with  Plugins -> Development -> Import plugin from manifest…  and it builds
// every screen without any server round-trip.
//
// Usage: node scripts/figma-plugin-build.mjs  (or: corepack pnpm figma:plugin)

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'docs', 'figma');
const outDir = join(root, 'figma-plugin');

const libRaw = await readFile(join(srcDir, 'lib.js'), 'utf8');

// lib.js was written for `eval`, where a later duplicate declaration simply wins.
// A plugin bundle is one strict scope, so drop the earlier copy of any duplicated
// top-level function (the later definition is the one that used to win).
function dedupeFunctions(src) {
  const lines = src.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:async )?function (\w+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    let end = i;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === '}') { end = j; break; }
    }
    blocks.push({ name: m[1], start: i, end });
    i = end;
  }
  const lastByName = new Map();
  for (const b of blocks) lastByName.set(b.name, b);
  const drop = new Set();
  for (const b of blocks) {
    if (lastByName.get(b.name) !== b) {
      for (let k = b.start; k <= b.end; k += 1) drop.add(k);
    }
  }
  if (!drop.size) return src;
  const dropped = blocks.filter((b) => drop.has(b.start)).map((b) => b.name);
  console.log('deduped earlier definitions:', [...new Set(dropped)].join(', '));
  return lines.filter((_, i) => !drop.has(i)).join('\n');
}

const lib = dedupeFunctions(libRaw);

const files = (await readdir(srcDir))
  .filter((f) => /^[sm]\d\d-[\w-]+\.js$/.test(f))
  .sort();

const screens = [];
for (const f of files) {
  const body = await readFile(join(srcDir, f), 'utf8');
  screens.push({ file: f, body });
}

const manifest = {
  name: 'SingBuild Workspace — screens',
  id: '1500000000000000001',
  api: '1.0.0',
  main: 'code.js',
  editorType: ['figma'],
  documentAccess: 'dynamic-page',
  networkAccess: { allowedDomains: ['none'] },
};

const chunks = [];
chunks.push('// GENERATED FILE — do not edit. Source: docs/figma/*.js');
chunks.push('// Build with: node scripts/figma-plugin-build.mjs');
chunks.push('(async function () {');
chunks.push('  var results = [];');
chunks.push('  try {');
chunks.push('    await figma.loadAllPagesAsync();');
chunks.push('');
chunks.push('    // ---------------- library ----------------');
chunks.push(lib);
chunks.push('');
chunks.push('    // ---------------- screens ----------------');
for (const s of screens) {
  chunks.push(`    // ===== ${s.file} =====`);
  chunks.push('    results.push(await (async function () {');
  chunks.push(s.body);
  chunks.push('    })());');
  chunks.push('');
}
chunks.push('    figma.notify("SingBuild: built " + results.length + " screens");');
chunks.push('    console.log("SingBuild screens", JSON.stringify(results, null, 2));');
chunks.push('  } catch (err) {');
chunks.push('    var msg = (err && err.message) || String(err);');
chunks.push('    console.error(err);');
chunks.push('    figma.notify("SingBuild failed: " + msg, { error: true, timeout: 30000 });');
chunks.push('  } finally {');
chunks.push('    figma.closePlugin();');
chunks.push('  }');
chunks.push('})();');
chunks.push('');

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const code = chunks.join('\n');
await writeFile(join(outDir, 'code.js'), code);

const warnings = [];
if (!lib.includes("family: 'Inter'")) warnings.push('Inter font names missing from lib.js');
for (const s of screens) {
  if (/\basync function\s+\w+\s*\(\s*\)\s*\{[\s\S]{0,40}\bawait\b/.test(s.body) === false) continue;
}

console.log(`bundled ${screens.length} screens -> ${join(outDir, 'code.js')} (${code.length} bytes)`);
for (const w of warnings) console.log('warning:', w);
