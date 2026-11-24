// Spike S7 (ROADMAP S2-07): can alphaTab play a Playback Score while it renders a Render Score?
// Node evidence for criteria C2–C6 (docs/spikes/s7-playback-score-variants.md §5). The browser
// criteria B1–B4 live in e2e/s7-browser.spec.ts.
import * as alphaTab from '@coderline/alphatab';
import { describe, expect, it } from 'vitest';
import { playbackDocument } from '../channels.ts';
import { newSettings } from '../run.ts';
import {
  attachPlaybackScore,
  channelVolumes,
  generatePlaybackMidi,
  rewriteMidiFile,
} from './hook.ts';
import { energy, renderOffline } from './offline-synth.ts';
import { variantPairs, type VariantPair } from './pairs.ts';

const { midi } = alphaTab;

/** What `AlphaTabApiBase.loadMidiForScore` generates from the rendered Score (alphaTab 1.9.0). */
function renderMidi(score: alphaTab.model.Score, settings: alphaTab.Settings) {
  const file = new midi.MidiFile();
  const generator = new midi.MidiFileGenerator(
    score,
    settings,
    new midi.AlphaSynthMidiFileHandler(file),
  );
  generator.applyTranspositionPitches = false;
  generator.generate();
  return { file, generator };
}

interface Ev {
  tick: number;
  kind: 'on' | 'off' | 'tempo';
  track?: number;
  channel?: number;
  key?: number;
  velocity?: number;
  bpm?: number;
}

function events(file: alphaTab.midi.MidiFile): Ev[] {
  const out: Ev[] = [];
  for (const e of file.events) {
    if (e instanceof midi.NoteOnEvent || e instanceof midi.NoteOffEvent)
      out.push({
        tick: e.tick,
        kind: e instanceof midi.NoteOnEvent ? 'on' : 'off',
        track: e.track,
        channel: e.channel,
        key: e.noteKey,
        velocity: e.noteVelocity,
      });
    else if (e instanceof midi.TempoChangeEvent)
      out.push({ tick: e.tick, kind: 'tempo', bpm: e.beatsPerMinute });
  }
  return out;
}

const lastTick = (file: alphaTab.midi.MidiFile) => Math.max(...file.events.map((e) => e.tick));

function keysOf(pair: VariantPair, trackIds: string[]): Set<number> {
  const keys = new Set<number>();
  for (const t of pair.doc.tracks.filter((x) => trackIds.includes(x.id)))
    for (const s of t.staves)
      for (const b of s.bars)
        for (const v of b.voices)
          for (const bt of v.beats)
            for (const n of bt.notes) if (n.pitch !== undefined) keys.add(n.pitch);
  return keys;
}

/** Loads the pair as alphaTab would and rewrites the MIDI like the hook (midiLoad step). */
function load(pair: VariantPair) {
  const settings = newSettings();
  const base = renderMidi(pair.render, settings);
  const renderEvents = events(base.file);
  const renderEndTick = lastTick(base.file);
  const rewritten = rewriteMidiFile(base.file, pair.playback, settings);
  const natural = generatePlaybackMidi(pair.playback, settings);
  return { settings, base, renderEvents, renderEndTick, rewritten, natural, file: base.file };
}

/** Share of note-ons whose Render beat (cursor lookup) has the MHD id of the playing beat. */
function beatCoherence(
  pair: VariantPair,
  file: alphaTab.midi.MidiFile,
  renderLookup: alphaTab.midi.MidiTickLookup,
  playbackLookup: alphaTab.midi.MidiTickLookup,
  tickShift: number,
) {
  const playbackIds = playbackDocument(pair.doc, pair.plan).tracks.map((t) => t.id);
  const renderIndex = new Map(pair.doc.tracks.map((t, i) => [t.id, i]));
  let total = 0;
  let same = 0;
  const mismatches: string[] = [];
  for (const e of events(file).filter((x) => x.kind === 'on')) {
    total++;
    const tick = e.tick - tickShift;
    const trackId = playbackIds[e.track ?? -1];
    const r = renderIndex.get(trackId ?? '');
    if (trackId === undefined || r === undefined) continue;
    const pBeat = playbackLookup.findBeat(new Set([e.track ?? -1]), tick)?.beat;
    const rBeat = renderLookup.findBeat(new Set([r]), tick)?.beat;
    const pId = pBeat ? pair.playbackIdMap.toMhd.get(pBeat) : undefined;
    const rId = rBeat ? pair.renderIdMap.toMhd.get(rBeat) : undefined;
    if (pId !== undefined && pId === rId) same++;
    else mismatches.push(`${tick} key ${e.key}: playback ${pId} render ${rId}`);
  }
  return { total, same, mismatches };
}

describe.each(variantPairs().map((p) => [p.name, p] as const))('pair %s', (_name, pair) => {
  it('has one excluded track, all tracks in the Render Score, the others in the Playback Score', () => {
    expect(pair.excluded).toHaveLength(1);
    expect(pair.render.tracks).toHaveLength(pair.doc.tracks.length);
    expect(pair.playback.tracks).toHaveLength(pair.doc.tracks.length - 1);
    // The placeholder of the excluded track collides with the first melodic track's channel.
    const excluded =
      pair.render.tracks[pair.doc.tracks.findIndex((t) => t.id === pair.excluded[0])];
    expect(excluded?.playbackInfo.primaryChannel).toBe(
      pair.render.tracks[0]?.playbackInfo.primaryChannel,
    );
  });

  it('C2: the rewritten MIDI keeps the Render Score time axis (tick shift, tempo, sync points, end)', () => {
    const { base, renderEvents, renderEndTick, rewritten, file } = load(pair);
    expect(file.tickShift).toBe(base.file.tickShift);
    expect(rewritten.tickShift).toBe(file.tickShift);
    expect(events(file).filter((e) => e.kind === 'tempo')).toEqual(
      renderEvents.filter((e) => e.kind === 'tempo'),
    );
    expect(lastTick(file)).toBe(renderEndTick);
    expect(JSON.stringify(midi.MidiFileGenerator.generateSyncPoints(pair.playback, true))).toBe(
      JSON.stringify(midi.MidiFileGenerator.generateSyncPoints(pair.render, true)),
    );
  });

  it('C3: the player gets exactly the Playback Score MIDI, nothing of the excluded track', () => {
    const { file, natural, rewritten } = load(pair);
    const delta = rewritten.tickShift - natural.naturalTickShift;
    const notes = (f: alphaTab.midi.MidiFile, shift = 0) =>
      events(f)
        .filter((e) => e.kind !== 'tempo')
        .map((e) => ({ ...e, tick: e.tick + shift }));
    expect(notes(file)).toEqual(notes(natural.midi, delta));
    const excludedKeys = keysOf(pair, pair.excluded);
    expect(notes(file).filter((e) => excludedKeys.has(e.key ?? -1))).toEqual([]);
    const playbackIds = playbackDocument(pair.doc, pair.plan).tracks.map((t) => t.id);
    const allowed = new Map(
      pair.plan.tracks.map((t) => [
        t.trackId,
        t.playback ? [t.playback.primary, t.playback.secondary] : [],
      ]),
    );
    for (const e of notes(file))
      expect(allowed.get(playbackIds[e.track ?? -1] ?? '')).toContain(e.channel);
    // Without the hook alphaTab would play the excluded track on its placeholder channel.
    const unhooked = events(renderMidi(pair.render, newSettings()).file);
    expect(
      unhooked.filter((e) => e.kind === 'on' && excludedKeys.has(e.key ?? -1)).length,
    ).toBeGreaterThan(0);
  });

  it('C4: every played note-on resolves to the same MHD beat in the Render Score cursor lookup', () => {
    const { base, rewritten, file } = load(pair);
    const result = beatCoherence(
      pair,
      file,
      base.generator.tickLookup,
      rewritten.tickLookup,
      file.tickShift,
    );
    expect(result.mismatches).toEqual([]);
    expect(result.same).toBe(result.total);
    expect(result.total).toBeGreaterThan(0);
  });

  it('C5: render-track volumes and transpositions differ from the Playback Score; the hook restores them', async () => {
    const settings = newSettings();
    const renderVolumes = channelVolumes(pair.render.tracks);
    const playbackVolumes = channelVolumes(pair.playback.tracks);
    // Finding: the excluded track's placeholder overwrites the first track's mix volume.
    expect(renderVolumes.get(0)).not.toBe(playbackVolumes.get(0));

    // alphaTab's order in loadMidiForScore / readyForPlayback (alphaTab.core.mjs 1.9.0), replayed.
    const volumes = new Map<number, number>();
    let transpositions = new Map<number, number>();
    const player = {
      setChannelVolume: (c: number, v: number) => volumes.set(c, v),
      applyTranspositionPitches: (m: Map<number, number>) => {
        transpositions = new Map(m);
      },
    } as unknown as alphaTab.synth.IAlphaSynth;
    const midiLoad = new Set<(f: alphaTab.midi.MidiFile) => void>();
    const ready = new Set<() => void>();
    const internalReady = () => {
      for (const [c, v] of channelVolumes(pair.render.tracks)) player.setChannelVolume(c, v);
    };
    ready.add(internalReady); // registered by alphaTab in the API constructor, before the hook
    const api = {
      score: pair.render,
      settings,
      player,
      midiLoad: {
        on: (f: (x: alphaTab.midi.MidiFile) => void) => (midiLoad.add(f), () => midiLoad.delete(f)),
        off: () => {},
      },
      playerReady: { on: (f: () => void) => (ready.add(f), () => ready.delete(f)), off: () => {} },
    };
    const hook = attachPlaybackScore(api, (r) => (r === pair.render ? pair.playback : undefined));
    const { file, generator } = renderMidi(pair.render, settings);
    for (const f of midiLoad) f(file);
    player.applyTranspositionPitches(generator.transpositionPitches); // rest of loadMidiForScore
    await Promise.resolve();
    for (const f of ready) f(); // readyForPlayback (worker message, later)
    expect(hook.stats).toMatchObject({ midiLoads: 1, rewritten: 1, failures: [] });
    expect(volumes).toEqual(playbackVolumes);
    expect(transpositions).toEqual(
      generatePlaybackMidi(pair.playback, settings).transpositionPitches,
    );
    hook.detach();
    expect([midiLoad.size, ready.size]).toEqual([0, 1]); // only alphaTab's own listener stays
  });
});

describe('E3-grace: tick shift', () => {
  const pair = variantPairs().find((p) => p.name === 'E3-grace');
  if (!pair) throw new Error('pair missing');

  it('the excluded grace note gives the Render Score a larger tick shift than the Playback Score', () => {
    const { rewritten, natural, base } = load(pair);
    expect(base.file.tickShift).toBeGreaterThan(0);
    expect(natural.naturalTickShift).toBe(0);
    expect(rewritten.tickShift).toBe(base.file.tickShift);
  });

  it('without the fixed shift the cursor would point at other beats (finding)', () => {
    const { base, natural } = load(pair);
    const naive = beatCoherence(
      pair,
      natural.midi,
      base.generator.tickLookup,
      natural.tickLookup,
      base.file.tickShift,
    );
    expect(naive.same).toBeLessThan(naive.total);
  });
});

describe('C6: mute and solo on the rewritten MIDI (offline AlphaSynth, sonivox.sf2)', () => {
  const pair = variantPairs().find((p) => p.name === 'E3');
  if (!pair) throw new Error('pair missing');
  const { file } = load(pair);
  // 120 BPM, 4/4: bar 1 (A only) 0–2 s, bar 2 (C only) 2–4 s. Margins skip attack and release.
  const A = (r: ReturnType<typeof renderOffline>) => energy(r, 0.05, 1.9);
  const C = (r: ReturnType<typeof renderOffline>) => energy(r, 2.4, 3.9);
  const channels = (i: number) => {
    const info = pair.render.tracks[i]?.playbackInfo;
    if (!info) throw new Error('track missing');
    return [info.primaryChannel, info.secondaryChannel];
  };
  const mute = (cs: number[]) => (s: alphaTab.synth.AlphaSynth) => {
    for (const c of cs) s.setChannelMute(c, true);
  };
  const solo = (cs: number[]) => (s: alphaTab.synth.AlphaSynth) => {
    for (const c of cs) s.setChannelSolo(c, true);
  };
  const playbackA = pair.playback.tracks[0];
  const playbackC = pair.playback.tracks[1];
  const pc = (t: alphaTab.model.Track | undefined) =>
    t ? [t.playbackInfo.primaryChannel, t.playbackInfo.secondaryChannel] : [];
  const full = renderOffline(file);

  it('both playable tracks sound without mute', () => {
    expect(A(full)).toBeGreaterThan(1);
    expect(C(full)).toBeGreaterThan(1);
  });

  it('muting Playback track A silences A only; solo C keeps only C', () => {
    const mutedA = renderOffline(file, mute(pc(playbackA)));
    expect(A(mutedA)).toBeLessThanOrEqual(A(full) * 0.01);
    expect(C(mutedA)).toBeGreaterThanOrEqual(C(full) * 0.5);
    const soloC = renderOffline(file, solo(pc(playbackC)));
    expect(A(soloC)).toBeLessThanOrEqual(A(full) * 0.01);
    expect(C(soloC)).toBeGreaterThanOrEqual(C(full) * 0.5);
  });

  it('finding: muting the excluded Render track (placeholder channel 0) silences track A', () => {
    const viaRender = renderOffline(file, mute(channels(1)));
    expect(A(viaRender)).toBeLessThanOrEqual(A(full) * 0.01);
    expect(C(viaRender)).toBeGreaterThanOrEqual(C(full) * 0.5);
  });
});

describe('hook without a Playback Score', () => {
  it('fails closed: the MIDI is emptied and a failure is recorded, nothing of the Render Score plays', () => {
    const pair = variantPairs()[0];
    if (!pair) throw new Error('pair missing');
    const settings = newSettings();
    const listeners: ((f: alphaTab.midi.MidiFile) => void)[] = [];
    const api = {
      score: pair.render,
      settings,
      player: null,
      midiLoad: {
        on: (f: (x: alphaTab.midi.MidiFile) => void) => (listeners.push(f), () => {}),
        off: () => {},
      },
      playerReady: { on: () => () => {}, off: () => {} },
    };
    const hook = attachPlaybackScore(api, () => undefined);
    const { file } = renderMidi(pair.render, settings);
    expect(file.events.length).toBeGreaterThan(0);
    for (const f of listeners) f(file);
    expect(file.events).toEqual([]);
    expect(hook.stats).toMatchObject({ midiLoads: 1, rewritten: 0 });
    expect(hook.stats.failures).toHaveLength(1);
  });

  it('fails closed when the Playback Score does not fit the Render time axis (larger tick shift)', () => {
    const [e3, e3grace] = variantPairs();
    if (!e3 || !e3grace) throw new Error('pairs missing');
    const settings = newSettings();
    const listeners: ((f: alphaTab.midi.MidiFile) => void)[] = [];
    const api = {
      score: e3.render,
      settings,
      player: null,
      midiLoad: {
        on: (f: (x: alphaTab.midi.MidiFile) => void) => (listeners.push(f), () => {}),
        off: () => {},
      },
      playerReady: { on: () => () => {}, off: () => {} },
    };
    // E3-grace's Render Score needs tick shift 120; E3's Render Score has 0: not a subset.
    const hook = attachPlaybackScore(api, () => e3grace.render);
    const { file } = renderMidi(e3.render, settings);
    expect(() => {
      for (const f of listeners) f(file);
    }).not.toThrow();
    expect(file.events).toEqual([]);
    expect(hook.stats.rewritten).toBe(0);
    expect(hook.stats.failures[0]).toMatch(/tick shift 120/);
  });

  it('does not touch the player after detach, even for a load just before it', async () => {
    const pair = variantPairs()[0];
    if (!pair) throw new Error('pair missing');
    const settings = newSettings();
    const calls: string[] = [];
    const player = {
      setChannelVolume: () => calls.push('volume'),
      applyTranspositionPitches: () => calls.push('transposition'),
    } as unknown as alphaTab.synth.IAlphaSynth;
    const listeners: ((f: alphaTab.midi.MidiFile) => void)[] = [];
    const api = {
      score: pair.render,
      settings,
      player,
      midiLoad: {
        on: (f: (x: alphaTab.midi.MidiFile) => void) => (listeners.push(f), () => {}),
        off: () => {},
      },
      playerReady: { on: () => () => {}, off: () => {} },
    };
    const hook = attachPlaybackScore(api, () => pair.playback);
    for (const f of listeners) f(renderMidi(pair.render, settings).file);
    hook.detach();
    await Promise.resolve();
    expect(hook.stats.rewritten).toBe(1);
    expect(calls).toEqual([]);
  });
});
