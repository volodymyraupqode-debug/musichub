// Spike S6 measurement runs. Writes the raw data of every run to data/raw/ (gzip JSON) with its
// configuration and environment. Configurations and repeats: S6_PLAN (JSON) or the default plan
// below. Run with `pnpm measure --project=<browser>`; runs are serial (workers = 1).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { test } from '@playwright/test';
import { startHarnessServer, type HarnessServer } from '../harness/server.ts';
import { runHarness, type RunConfig } from './run.ts';

interface PlanEntry extends RunConfig {
  repeat: number;
}

const DEFAULT_PLAN: PlanEntry[] = [
  ...[1, 2, 3].map((repeat) => ({ interval: 10, speed: 1, seconds: 60, repeat })),
  ...[1, 2, 3].map((repeat) => ({ interval: 0, speed: 1, seconds: 60, repeat })),
  { interval: 10, speed: 0.5, seconds: 60, repeat: 1 },
  { interval: 10, speed: 1.5, seconds: 60, repeat: 1 },
  { interval: 10, speed: 1, seconds: 300, repeat: 1 },
];
const plan: PlanEntry[] = process.env.S6_PLAN
  ? (JSON.parse(process.env.S6_PLAN) as PlanEntry[])
  : DEFAULT_PLAN;
const OUT = path.join(import.meta.dirname, '../data/raw');

let server: HarnessServer;
test.beforeAll(async () => {
  server = await startHarnessServer();
});
test.afterAll(async () => {
  await server.close();
});

for (const entry of plan) {
  const name = `i${entry.interval}-s${entry.speed}-d${entry.seconds}-r${entry.repeat}`;
  test(`measure ${name}`, async ({ page, browserName }, info) => {
    test.setTimeout((entry.seconds + 120) * 1000);
    const raw = await runHarness(page, server.origin, entry);
    const record = {
      ...raw,
      meta: {
        ...raw.meta,
        run: { ...entry, browser: browserName, project: info.project.name, headless: true },
        host: { platform: process.platform, arch: process.arch, node: process.version },
        recordedAt: new Date().toISOString(),
      },
    };
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      path.join(OUT, `${info.project.name}-${name}.json.gz`),
      gzipSync(JSON.stringify(record)),
    );
  });
}
