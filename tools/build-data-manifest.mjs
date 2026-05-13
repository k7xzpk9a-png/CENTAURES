#!/usr/bin/env node
// Generate static/data/manifest.json by enumerating .dat files under static/data/.
// Flutter's runtime AssetManifest enumerates assets at startup; we don't have
// that on the web, so we ship the list as a static JSON file that the
// AssetResolver fetches once on boot.
//
// Run manually after adding/removing .dat files:
//   npm run data:manifest
//
// Paths in the manifest are relative to /data/ (so AssetResolver requests
// `/data/${path}` at runtime).

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..', 'static', 'data');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...walk(abs));
    } else if (entry.toLowerCase().endsWith('.dat')) {
      out.push(relative(root, abs).split('\\').join('/'));
    }
  }
  return out;
}

const files = walk(root).sort();
const manifestPath = join(root, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(files));
console.log(`Wrote ${manifestPath} — ${files.length} .dat files`);
