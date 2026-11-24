// Spike S3 (ROADMAP S2-10): static server for the edit-loop harness. The browser runs the real S2
// adapter (Strategy A) and the S7 playback hook: their TypeScript sources are served with the types
// stripped by Node, `@musichub/music-model` from its build output and zod from its ESM files.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MhdDocument } from '@musichub/music-model';
import { canonical } from '../src/fixtures.ts';
import { performanceDocument } from '../src/performance.ts';

const here = import.meta.dirname;
const SRC = path.resolve(here, '../src');
const dirOf = (specifier: string) => path.dirname(fileURLToPath(import.meta.resolve(specifier)));
const ROOTS: Record<string, string> = {
  '/alphatab/': dirOf('@coderline/alphatab'),
  '/mm/': dirOf('@musichub/music-model'),
  // zod as music-model resolves it (its ESM files import each other relatively).
  '/zod/': path.dirname(
    createRequire(path.join(dirOf('@musichub/music-model'), '..', 'package.json')).resolve('zod'),
  ),
};

/** The documents of the S3 scenarios (built in Node, served as JSON). */
export const DOCUMENTS: Record<string, () => MhdDocument> = {
  small: () => canonical('band-repeats'),
  medium: () => performanceDocument(50),
  large: () => performanceDocument(300),
};

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.ts': 'text/javascript',
  '.json': 'application/json',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.svg': 'image/svg+xml',
};

export interface EditLoopServer {
  origin: string;
  close: () => Promise<void>;
}

const inside = (root: string, file: string) => file.startsWith(root + path.sep);

export async function startEditLoopServer(port = 0): Promise<EditLoopServer> {
  const docs = new Map(Object.entries(DOCUMENTS).map(([k, f]) => [k, JSON.stringify(f())]));
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let body: string | Buffer | undefined;
    let file = '';
    try {
      if (url.pathname === '/') {
        file = path.join(here, 'edit-loop-harness.html');
        body = readFileSync(file);
      } else if (url.pathname.startsWith('/docs/')) {
        body = docs.get(url.pathname.slice('/docs/'.length).replace(/\.json$/, ''));
        file = 'x.json';
      } else if (url.pathname.startsWith('/s2/')) {
        file = path.normalize(path.join(SRC, url.pathname.slice('/s2/'.length)));
        if (inside(SRC, file) && file.endsWith('.ts') && !file.endsWith('.test.ts'))
          body = stripTypeScriptTypes(readFileSync(file, 'utf8'));
      } else {
        for (const [prefix, root] of Object.entries(ROOTS))
          if (url.pathname.startsWith(prefix)) {
            file = path.normalize(path.join(root, url.pathname.slice(prefix.length)));
            if (inside(root, file)) body = readFileSync(file);
          }
      }
    } catch {
      body = undefined;
    }
    if (body === undefined) res.writeHead(404).end();
    else
      res
        .writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
        .end(body);
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
