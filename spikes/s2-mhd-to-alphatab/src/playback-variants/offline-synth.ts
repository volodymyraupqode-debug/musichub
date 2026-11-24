// Spike S7: offline audio with alphaTab's own synthesizer (AlphaSynth + TinySoundFont) in Node.
// A pull-driven ISynthOutput replaces the Web Audio output: every sample request is answered at
// once, so a song renders as fast as the CPU allows and the result is deterministic.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as alphaTab from '@coderline/alphatab';

class Emitter implements alphaTab.IEventEmitter {
  private readonly listeners = new Set<() => void>();
  on(value: () => void): () => void {
    this.listeners.add(value);
    return () => this.listeners.delete(value);
  }
  off(value: () => void): void {
    this.listeners.delete(value);
  }
  trigger(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

class EmitterOfT<T> implements alphaTab.IEventEmitterOfT<T> {
  private readonly listeners = new Set<(arg: T) => void>();
  on(value: (arg: T) => void): () => void {
    this.listeners.add(value);
    return () => this.listeners.delete(value);
  }
  off(value: (arg: T) => void): void {
    this.listeners.delete(value);
  }
  trigger(arg: T): void {
    for (const listener of [...this.listeners]) listener(arg);
  }
}

class OfflineOutput implements alphaTab.synth.ISynthOutput {
  readonly sampleRate = 44_100;
  readonly ready = new Emitter();
  readonly samplesPlayed = new EmitterOfT<number>();
  readonly sampleRequest = new Emitter();
  readonly chunks: Float32Array[] = [];
  open(): void {}
  play(): void {}
  pause(): void {}
  destroy(): void {}
  resetSamples(): void {}
  activate(): void {}
  addSamples(samples: Float32Array): void {
    this.chunks.push(samples.slice());
  }
  enumerateOutputDevices(): Promise<alphaTab.synth.ISynthOutputDevice[]> {
    return Promise.resolve([]);
  }
  setOutputDevice(): Promise<void> {
    return Promise.resolve();
  }
  getOutputDevice(): Promise<alphaTab.synth.ISynthOutputDevice | null> {
    return Promise.resolve(null);
  }
}

const SOUNDFONT = fileURLToPath(
  new URL('soundfont/sonivox.sf2', import.meta.resolve('@coderline/alphatab')),
);

export interface OfflineRender {
  sampleRate: number;
  /** Interleaved stereo samples. */
  samples: Float32Array;
}

/**
 * Plays `midi` to the end. `prepare` runs after the MIDI is loaded and before playback starts
 * (mute, solo and volume calls go there, as in the browser).
 */
export function renderOffline(
  midi: alphaTab.midi.MidiFile,
  prepare: (synth: alphaTab.synth.AlphaSynth) => void = () => {},
): OfflineRender {
  const output = new OfflineOutput();
  const synth = new alphaTab.synth.AlphaSynth(output, 500);
  synth.logLevel = alphaTab.LogLevel.None;
  output.ready.trigger();
  synth.loadSoundFont(new Uint8Array(readFileSync(SOUNDFONT)), false);
  synth.loadMidiFile(midi);
  if (!synth.isReadyForPlayback) throw new Error('AlphaSynth is not ready for playback');
  prepare(synth);
  let finished = false;
  synth.finished.on(() => {
    finished = true;
  });
  if (!synth.play()) throw new Error('AlphaSynth did not start');
  for (let i = 0; !finished && i < 100_000; i++) {
    const before = output.chunks.length;
    output.sampleRequest.trigger();
    const chunk = output.chunks[before];
    output.samplesPlayed.trigger(chunk ? chunk.length / 2 : 0);
    if (!chunk || chunk.length === 0) break;
  }
  synth.destroy();
  const length = output.chunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of output.chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return { sampleRate: output.sampleRate, samples };
}

/** Sum of squared samples between two times in seconds. */
export function energy(render: OfflineRender, from: number, to: number): number {
  const start = Math.floor(from * render.sampleRate) * 2;
  const end = Math.min(render.samples.length, Math.floor(to * render.sampleRate) * 2);
  let sum = 0;
  for (let i = start; i < end; i++) sum += (render.samples[i] ?? 0) ** 2;
  return sum;
}
