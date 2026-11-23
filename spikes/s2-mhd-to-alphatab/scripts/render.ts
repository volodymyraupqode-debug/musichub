// Visual check (`pnpm render`): renders every S2 document with both strategies through alphaTab's
// ScoreRenderer (SVG, Node) into results/render/<name>.html (A above B) and takes PNG screenshots
// with Playwright Chromium. `--docs` also copies the canonical screenshots to docs/spikes/.
import type * as alphaTab from '@coderline/alphatab';
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { allDocuments } from '../src/fixtures.ts';
import { renderScore } from '../src/render.ts';
import { newSettings } from '../src/run.ts';
import { toAlphaTabDirect } from '../src/strategy-a.ts';
import { toAlphaTabViaTex } from '../src/strategy-b.ts';

const out = path.resolve(import.meta.dirname, '../results/render');
const docsDir = path.resolve(import.meta.dirname, '../../../docs/spikes/s2-mhd-to-alphatab');
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const fontFile = require.resolve('@coderline/alphatab/font/Bravura.woff2');
const musicFontSize = newSettings().display.resources.engravingSettings.musicFontSize;
// Same rules alphaTab injects in the browser (BrowserUiFacade): the music glyphs use class "at".
const css = `@font-face { font-family: 'alphaTab'; src: url('${pathToFileURL(fontFile).href}') format('woff2'); }
.at { font-family: 'alphaTab'; font-style: normal; font-weight: normal; line-height: 1; font-size: ${musicFontSize}px; overflow: visible; }
body { margin: 0; background: #fff; font: 14px Arial, sans-serif; } h2 { margin: 8px 12px; font-size: 15px; } section { border-bottom: 2px solid #888; }`;

const pages: { name: string; kind: string; file: string }[] = [];
for (const { name, kind, doc } of allDocuments()) {
  const parts = [
    ['Strategy A — direct model + finish()', toAlphaTabDirect(doc, newSettings()).score],
    ['Strategy B — alphaTex + AlphaTexImporter', toAlphaTabViaTex(doc, newSettings()).score],
  ] as const;
  const sections = parts.map(([label, score]) => {
    const r = renderScore(score as alphaTab.model.Score, newSettings());
    return `<section><h2>${label} · ${r.masterBars} master bars, ${r.beats} beats, ${r.notes} notes${r.error ? ` · ERROR ${r.error}` : ''}</h2>${r.svg}</section>`;
  });
  const file = path.join(out, `${name}.html`);
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>${name}</title><style>${css}</style>${sections.join('')}`,
  );
  pages.push({ name, kind, file });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
for (const p of pages) {
  await page.goto(pathToFileURL(p.file).href);
  // Wait for the Bravura web font (runs in the page; `document` exists there, not in Node).
  await page.waitForFunction('document.fonts.status === "loaded"');
  const png = path.join(out, `${p.name}.png`);
  await page.screenshot({ path: png, fullPage: true });
  if (process.argv.includes('--docs') && p.kind === 'canonical') {
    mkdirSync(docsDir, { recursive: true });
    copyFileSync(png, path.join(docsDir, `${p.name}.png`));
  }
  console.log('rendered', path.relative(process.cwd(), png));
}
await browser.close();
