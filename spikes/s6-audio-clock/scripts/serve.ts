// Spike S6: serve the harness for manual runs (docs/spikes/s6-audio-clock-accuracy.md §8).
import { startHarnessServer } from '../harness/server.ts';

const server = await startHarnessServer(Number(process.env.PORT ?? 3280));
console.log(`S6 harness: ${server.origin}/?interval=10&speed=1&seconds=60`);
console.log(`Loopback run: ${server.origin}/?interval=10&seconds=60&loopback=1`);
