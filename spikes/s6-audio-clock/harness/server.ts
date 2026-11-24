// Spike S6: static server for the measurement harness (harness/index.html) and alphaTab's dist
// files (workers, audio worklet, fonts, SoundFont). Used by the Playwright specs and by
// `pnpm serve` for manual (loopback) runs.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = import.meta.dirname;
const DIST = path.dirname(fileURLToPath(import.meta.resolve('@coderline/alphatab')));

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  '.svg': 'image/svg+xml',
};

export interface HarnessServer {
  origin: string;
  close: () => Promise<void>;
}

export async function startHarnessServer(port = 0): Promise<HarnessServer> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file: string | undefined;
    if (url.pathname === '/') file = path.join(here, 'index.html');
    else if (url.pathname.startsWith('/alphatab/')) {
      const candidate = path.normalize(path.join(DIST, url.pathname.slice('/alphatab/'.length)));
      if (candidate.startsWith(DIST + path.sep)) file = candidate;
    }
    let body: Buffer | undefined;
    try {
      body = file ? readFileSync(file) : undefined;
    } catch {
      body = undefined;
    }
    if (!file || !body) {
      res.writeHead(404).end();
      return;
    }
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
