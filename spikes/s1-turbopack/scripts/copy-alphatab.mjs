// Copies the alphaTab runtime assets into public/alphatab (ARCHITECTURE.md §4, alphaTab docs
// "Next.js with Turbopack"). Turbopack bundles the workers itself, but the audio worklet and the
// fonts/SoundFont are loaded by URL, so they must be served as static files.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve('@coderline/alphatab'));
const target = path.join(import.meta.dirname, '..', 'public', 'alphatab');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const entry of ['font', 'soundfont', 'alphaTab.mjs', 'alphaTab.core.mjs']) {
  cpSync(path.join(dist, entry), path.join(target, entry), { recursive: true });
}
