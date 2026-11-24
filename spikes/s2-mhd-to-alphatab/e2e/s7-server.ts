// Spike S7: a small static server for the browser harness. It serves the harness page, alphaTab's
// dist files (workers, worklet, fonts, SoundFont), the hook with its types stripped by Node, and
// the E3 and E16 Score pairs serialized with alphaTab's JsonConverter.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { stripTypeScriptTypes } from 'node:module';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as alphaTab from '@coderline/alphatab';
import { variantPairs } from '../src/playback-variants/pairs.ts';

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

export interface S7Server {
  origin: string;
  close: () => Promise<void>;
}

export async function startS7Server(port = 0): Promise<S7Server> {
  const hook = stripTypeScriptTypes(
    readFileSync(path.join(here, '../src/playback-variants/hook.ts'), 'utf8'),
  );
  const data = JSON.stringify(
    Object.fromEntries(
      variantPairs()
        .filter((p) => p.name !== 'E3-grace')
        .map((p) => [
          p.name,
          {
            render: alphaTab.model.JsonConverter.scoreToJson(p.render),
            playback: alphaTab.model.JsonConverter.scoreToJson(p.playback),
          },
        ]),
    ),
  );
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let body: string | Buffer | undefined;
    let type = 'application/octet-stream';
    if (url.pathname === '/') {
      body = readFileSync(path.join(here, 's7-harness.html'));
      type = 'text/html';
    } else if (url.pathname === '/hook.js') {
      body = hook;
      type = 'text/javascript';
    } else if (url.pathname === '/pairs.json') {
      body = data;
      type = 'application/json';
    } else if (url.pathname.startsWith('/alphatab/')) {
      const file = path.normalize(path.join(DIST, url.pathname.slice('/alphatab/'.length)));
      if (file.startsWith(DIST + path.sep)) {
        try {
          body = readFileSync(file);
          type = TYPES[path.extname(file)] ?? type;
        } catch {
          body = undefined;
        }
      }
    }
    if (body === undefined) res.writeHead(404).end();
    else res.writeHead(200, { 'content-type': type }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
