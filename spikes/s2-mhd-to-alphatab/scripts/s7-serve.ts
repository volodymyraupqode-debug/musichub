// Spike S7: serve the browser harness for the manual checklist (docs/spikes/s7-playback-score-variants.md).
import { startS7Server } from '../e2e/s7-server.ts';

const server = await startS7Server(Number(process.env.PORT ?? 3270));
console.log(
  `S7 harness: ${server.origin}/  (control without the hook: ${server.origin}/?hook=off)`,
);
