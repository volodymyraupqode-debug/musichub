'use client';

import { AlphaTabApi, type json } from '@coderline/alphatab';
import { useEffect, useRef, useState } from 'react';
import { SPIKE_SCORE } from '../score';
import { installProbes, probes, type SpikeProbes } from '../probes';

type Theme = 'light' | 'dark';

const THEMES: Record<Theme, { background: string; resources: json.RenderingResourcesJson }> = {
  light: {
    background: '#ffffff',
    resources: {
      mainGlyphColor: '#1f2328',
      secondaryGlyphColor: '#57606a',
      staffLineColor: '#8c959f',
      barSeparatorColor: '#57606a',
      scoreInfoColor: '#1f2328',
      barNumberColor: '#57606a',
    },
  },
  dark: {
    background: '#0d1117',
    resources: {
      mainGlyphColor: '#e6edf3',
      secondaryGlyphColor: '#9198a1',
      staffLineColor: '#6e7681',
      barSeparatorColor: '#9198a1',
      scoreInfoColor: '#e6edf3',
      barNumberColor: '#9198a1',
    },
  },
};

/** Spike S1: alphaTab 1.9.0 in Next.js 16 (Turbopack). Created only in the browser, destroyed on unmount. */
export function ScoreSpike() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<AlphaTabApi | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [snapshot, setSnapshot] = useState<SpikeProbes>(probes);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    installProbes();
    probes.mountedAt = performance.now();

    const instance = new AlphaTabApi(element, {
      core: {
        scriptFile: '/alphatab/alphaTab.mjs',
        fontDirectory: '/alphatab/font/',
        useWorkers: true,
      },
      display: { resources: THEMES.light.resources },
      player: {
        enablePlayer: true,
        playerMode: 'EnabledSynthesizer',
        outputMode: 'WebAudioAudioWorklets',
        soundFont: '/alphatab/soundfont/sonivox.sf2',
        enableCursor: true,
      },
    });
    api.current = instance;
    probes.rendererType = instance.renderer.constructor.name;

    instance.renderStarted.on(() => {
      probes.renderStarted += 1;
    });
    instance.renderFinished.on(() => {
      probes.renderFinished += 1;
      probes.firstRenderMs ??= Math.round(performance.now() - probes.mountedAt);
      probes.renderedTracks = instance.tracks.length;
    });
    instance.error.on((error) => probes.errors.push(String(error.message)));
    instance.scoreLoaded.on((score) => {
      probes.scoreTracks = score.tracks.length;
      probes.scoreMasterBars = score.masterBars.length;
    });
    instance.soundFontLoaded.on(() => {
      probes.soundFontLoaded = true;
      probes.soundFontLoadedMs = Math.round(performance.now() - probes.mountedAt);
    });
    instance.playerReady.on(() => {
      probes.playerReady = true;
      probes.playerReadyMs = Math.round(performance.now() - probes.mountedAt);
    });
    instance.playerStateChanged.on((event) => {
      probes.playerState = event.state === 1 ? 'playing' : 'paused';
      if (event.state === 1 && probes.playClickedAt !== undefined) {
        probes.playingStateMs ??= Math.round(performance.now() - probes.playClickedAt);
      }
    });
    instance.playerPositionChanged.on((event) => {
      probes.positionMs = Math.round(event.currentTime);
      probes.positionEvents += 1;
      if (probes.positionSamples.length < 200) probes.positionSamples.push(probes.positionMs);
      if (
        probes.playClickedAt !== undefined &&
        probes.firstPositionMs === undefined &&
        event.currentTime > 0
      ) {
        probes.firstPositionMs = Math.round(performance.now() - probes.playClickedAt);
      }
    });

    // tex() renders only the first track unless told otherwise.
    instance.tex(SPIKE_SCORE, 'all');

    const timer = window.setInterval(
      () =>
        setSnapshot({
          ...probes,
          workers: [...probes.workers],
          worklets: [...probes.worklets],
          errors: [...probes.errors],
          positionSamples: [...probes.positionSamples],
        }),
      250,
    );
    return () => {
      window.clearInterval(timer);
      instance.destroy();
      api.current = null;
    };
  }, []);

  const applyTheme = (next: Theme) => {
    const instance = api.current;
    if (!instance) return;
    setTheme(next);
    probes.theme = next;
    instance.settings.fillFromJson({ display: { resources: THEMES[next].resources } });
    instance.updateSettings();
    instance.render();
  };

  return (
    <main style={{ background: THEMES[theme].background, minHeight: '100vh', padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          data-testid="play-pause"
          disabled={!snapshot.playerReady}
          onClick={() => {
            probes.playClickedAt ??= performance.now();
            api.current?.playPause();
          }}
        >
          Play / Pause
        </button>
        <button type="button" data-testid="stop" onClick={() => api.current?.stop()}>
          Stop
        </button>
        <button
          type="button"
          data-testid="theme"
          onClick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}
        >
          Theme: {theme}
        </button>
      </div>
      <div ref={host} data-testid="score" />
      <pre
        data-testid="probes"
        style={{ background: '#f6f8fa', color: '#1f2328', padding: 8, fontSize: 12 }}
      >
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </main>
  );
}
