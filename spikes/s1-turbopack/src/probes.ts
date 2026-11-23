// Spike-only instrumentation. It records what alphaTab actually does in the browser instead of
// trusting a quiet console: which workers start, whether the audio worklet module loads, and the
// AudioContext state. Exposed as `window.__s1` for Playwright and manual checks.

export type SpikeProbes = {
  mountedAt: number;
  rendererType: string;
  renderStarted: number;
  renderFinished: number;
  firstRenderMs?: number;
  /** Tracks in the parsed score and tracks alphaTab actually renders. */
  scoreTracks: number;
  scoreMasterBars: number;
  renderedTracks: number;
  theme: 'light' | 'dark';
  workers: string[];
  worklets: { url: string; ok?: boolean; error?: string }[];
  audioContextStates: string[];
  audioContextSampleRate?: number;
  audioContextOutputLatency?: number;
  soundFontLoaded: boolean;
  soundFontLoadedMs?: number;
  playerReady: boolean;
  playerReadyMs?: number;
  playerState: 'paused' | 'playing';
  positionMs: number;
  positionEvents: number;
  playClickedAt?: number;
  /** Play click → state `playing`. */
  playingStateMs?: number;
  /** Play click → first position > 0, i.e. the synth consumed audio. Not the audible latency. */
  firstPositionMs?: number;
  positionSamples: number[];
  errors: string[];
};

export const probes: SpikeProbes = {
  mountedAt: 0,
  rendererType: '',
  renderStarted: 0,
  renderFinished: 0,
  scoreTracks: 0,
  scoreMasterBars: 0,
  renderedTracks: 0,
  theme: 'light',
  workers: [],
  worklets: [],
  audioContextStates: [],
  soundFontLoaded: false,
  playerReady: false,
  playerState: 'paused',
  positionMs: 0,
  positionEvents: 0,
  positionSamples: [],
  errors: [],
};

declare global {
  interface Window {
    __s1?: SpikeProbes;
  }
}

let installed = false;

export function installProbes(): void {
  window.__s1 = probes;
  if (installed) return;
  installed = true;

  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      probes.workers.push(`${String(url)} (${options?.type ?? 'classic'})`);
    }
  };

  // Absent in browsers without AudioWorklet support; alphaTab then uses ScriptProcessor.
  if (typeof AudioWorklet !== 'undefined') installWorkletProbe();

  const NativeAudioContext = window.AudioContext;
  window.AudioContext = class extends NativeAudioContext {
    constructor(options?: AudioContextOptions) {
      super(options);
      probes.audioContextSampleRate = this.sampleRate;
      probes.audioContextStates.push(this.state);
      this.addEventListener('statechange', () => {
        probes.audioContextStates.push(this.state);
        probes.audioContextOutputLatency = this.outputLatency;
      });
    }
  };

  window.addEventListener('error', (event) => probes.errors.push(String(event.message)));
  window.addEventListener('unhandledrejection', (event) =>
    probes.errors.push(String(event.reason)),
  );
}

function installWorkletProbe(): void {
  const addModule = AudioWorklet.prototype.addModule;
  AudioWorklet.prototype.addModule = async function (
    this: AudioWorklet,
    url: string | URL,
    options?: WorkletOptions,
  ) {
    const record: SpikeProbes['worklets'][number] = { url: String(url) };
    probes.worklets.push(record);
    try {
      await addModule.call(this, url, options);
      record.ok = true;
    } catch (error) {
      record.ok = false;
      record.error = String(error);
      throw error;
    }
  };
}
