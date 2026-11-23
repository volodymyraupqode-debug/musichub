// MIDI channel allocation (decision Q-C with separate Render and Playback Scores). Every check
// inspects the alphaTab Score objects and the MIDI generated from the Playback Score.
import * as alphaTab from '@coderline/alphatab';
import { validateDocument, type MhdDocument, type Track } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { FIRST_BAR, bar, beat, d, documentOf, idSource, staff, track, voice } from './builders.ts';
import { MELODIC_CHANNELS } from './channels.ts';
import type { Loss } from './losses.ts';
import { midiSummary } from './midi.ts';
import { renderScore } from './render.ts';
import { newSettings } from './run.ts';
import { toAlphaTabDirect } from './strategy-a.ts';
import { toAlphaTabViaTex } from './strategy-b.ts';

type PercussionAt = 'none' | 'start' | 'middle' | 'end';

/**
 * `programs[k]` = [program, bank] of melodic track k (default: program k, bank 0, all distinct).
 * Melodic track k plays one whole note of pitch 40 + k, so its MIDI notes are identifiable.
 */
function makeDoc(
  melodic: number,
  percussion: PercussionAt,
  programs: [number, number][] = [],
): MhdDocument {
  const id = idSource('CH');
  const one = (pitch: number) => [staff(id, [bar(id, [voice(id, [beat(id, d(1), [{ pitch }])])])])];
  const tracks: Track[] = Array.from({ length: melodic }, (_, k) => {
    const [program, bank] = programs[k] ?? [k, 0];
    return track(
      id,
      `M${k + 1}`,
      { family: 'other', midiProgram: program, ...(bank ? { bank } : {}), percussion: false },
      one(40 + k),
    );
  });
  const drums = track(id, 'Drums', { family: 'drums', midiProgram: 0, percussion: true }, one(36));
  const at = { none: -1, start: 0, middle: Math.min(3, melodic), end: melodic }[percussion];
  if (at >= 0) tracks.splice(at, 0, drums);
  return documentOf('01900000-0000-7000-8000-000000000777', 'channels', [FIRST_BAR], tracks, id);
}

const strategies = [
  ['A', (doc: MhdDocument) => toAlphaTabDirect(doc, newSettings())],
  ['B', (doc: MhdDocument) => toAlphaTabViaTex(doc, newSettings())],
] as const;

const channelsOf = (score: alphaTab.model.Score) =>
  score.tracks.map((t) => ({
    name: t.name,
    percussion: t.isPercussion,
    program: t.playbackInfo.program,
    bank: t.playbackInfo.bank,
    primary: t.playbackInfo.primaryChannel,
    secondary: t.playbackInfo.secondaryChannel,
  }));

const channelDiagnostics = (losses: Loss[]) =>
  losses.filter((l) => l.feature === 'track.playbackChannel');

const COUNTS = [1, 7, 8, 15, 16, 20, 25];
const PLACEMENTS: PercussionAt[] = ['none', 'start', 'middle', 'end'];
const matrix = COUNTS.flatMap((n) => PLACEMENTS.map((p) => [n, p] as const));

describe.each(matrix)('%i melodic tracks, percussion %s', (melodic, percussion) => {
  const doc = makeDoc(melodic, percussion);
  const excluded = Math.max(0, melodic - MELODIC_CHANNELS.length); // all programs distinct
  const results = strategies.map(([label, convert]) => [label, convert(doc)] as const);

  it('is valid MHD', () => {
    expect(validateDocument(doc).valid).toBe(true);
  });

  it.each(results)(
    'Strategy %s: Render Score keeps every track; Playback Score only playable ones',
    (_, r) => {
      expect(r.renderScore.tracks.map((t) => t.name)).toEqual(doc.tracks.map((t) => t.name));
      const playable = doc.tracks.filter(
        (t) => t.instrument.percussion || Number(t.name.slice(1)) <= 15,
      );
      expect(r.playbackScore.tracks.map((t) => t.name)).toEqual(playable.map((t) => t.name));
      // Identity as a boolean: `not.toBe` would deep-compare two cyclic alphaTab graphs (very slow).
      expect((r.playbackScore as object) === (r.renderScore as object)).toBe(false);
    },
  );

  it.each(results)(
    'Strategy %s: channels are valid in both Scores, percussion 9/9, melodic never 9',
    (_, r) => {
      for (const score of [r.renderScore, r.playbackScore]) {
        for (const t of channelsOf(score)) {
          for (const c of [t.primary, t.secondary]) expect(c >= 0 && c <= 15).toBe(true);
          if (t.percussion) expect([t.primary, t.secondary]).toEqual([9, 9]);
          else {
            expect(t.primary).not.toBe(9);
            expect(t.secondary).not.toBe(9);
          }
        }
      }
    },
  );

  it.each(results)(
    'Strategy %s: no Playback Score channel is shared by different programs or banks',
    (_, r) => {
      const owners = new Map<number, string>();
      for (const t of channelsOf(r.playbackScore).filter((x) => !x.percussion)) {
        for (const c of new Set([t.primary, t.secondary])) {
          const instrument = `${t.program}/${t.bank}`;
          expect(owners.get(c) ?? instrument).toBe(instrument);
          owners.set(c, instrument);
        }
      }
      // The generated MIDI agrees: one program per melodic channel, only playable notes.
      const midi = new alphaTab.midi.MidiFile();
      new alphaTab.midi.MidiFileGenerator(
        r.playbackScore,
        newSettings(),
        new alphaTab.midi.AlphaSynthMidiFileHandler(midi, true),
      ).generate();
      const programs = new Map<number, Set<number>>();
      for (const e of midi.events)
        if (e instanceof alphaTab.midi.ProgramChangeEvent && e.channel !== 9)
          programs.set(e.channel, (programs.get(e.channel) ?? new Set()).add(e.program));
      for (const set of programs.values()) expect(set.size).toBe(1);
      const keys = new Set(
        midiSummary(r.playbackScore, newSettings())
          .events.filter((e) => e.startsWith('on '))
          .map((e) => Number(/ k(\d+)/.exec(e)?.[1])),
      );
      const playableMelodic = Math.min(melodic, 15);
      const expected = [
        ...Array.from({ length: playableMelodic }, (_, k) => 40 + k),
        ...(percussion === 'none' ? [] : [36]),
      ];
      expect([...keys].sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    },
  );

  it.each(results)(
    'Strategy %s: an engine-policy warning for every excluded track, with its MHD id',
    (_, r) => {
      const warnings = channelDiagnostics(r.losses).filter((l) => l.severity === 'warning');
      const excludedIds = doc.tracks
        .filter((t) => !t.instrument.percussion && Number(t.name.slice(1)) > 15)
        .map((t) => t.id);
      expect(excludedIds).toHaveLength(excluded);
      expect(warnings.map((w) => [w.id, w.code, w.severity, w.aspect])).toEqual(
        excludedIds.map((id) => [id, 'engine-policy', 'warning', 'playback']),
      );
      for (const w of warnings) expect(w.detail).toMatch(/playback unavailable/);
    },
  );

  it('Strategy A and B agree on both Scores and the diagnostics, and runs are deterministic', () => {
    const [a, b] = results.map(([, r]) => r);
    if (!a || !b) throw new Error('missing result');
    expect(channelsOf(b.renderScore)).toEqual(channelsOf(a.renderScore));
    expect(channelsOf(b.playbackScore)).toEqual(channelsOf(a.playbackScore));
    expect(channelDiagnostics(b.losses)).toEqual(channelDiagnostics(a.losses));
    const again = toAlphaTabDirect(doc, newSettings());
    expect(channelsOf(again.renderScore)).toEqual(channelsOf(a.renderScore));
    expect(channelsOf(again.playbackScore)).toEqual(channelsOf(a.playbackScore));
    expect(channelDiagnostics(again.losses)).toEqual(channelDiagnostics(a.losses));
  });
});

describe('melodic indexing does not depend on where the percussion track is', () => {
  it.each(COUNTS)('%i melodic tracks', (melodic) => {
    const melodicChannels = (p: PercussionAt) =>
      channelsOf(toAlphaTabDirect(makeDoc(melodic, p), newSettings()).playbackScore)
        .filter((t) => !t.percussion)
        .map((t) => [t.name, t.primary, t.secondary]);
    const reference = melodicChannels('none');
    for (const p of PLACEMENTS) expect(melodicChannels(p)).toEqual(reference);
  });
});

describe('sharing between identical program and bank', () => {
  // 15 distinct programs, then: program 3 (twice), 14, 20 (new), 3 with bank 1 (different bank).
  const programs: [number, number][] = [
    ...Array.from({ length: 15 }, (_, k): [number, number] => [k, 0]),
    [3, 0],
    [3, 0],
    [14, 0],
    [20, 0],
    [3, 1],
  ];
  const doc = makeDoc(20, 'middle', programs);

  it.each(strategies)(
    'Strategy %s: shares the earliest compatible channel, excludes the rest',
    (_, convert) => {
      expect(validateDocument(doc).valid).toBe(true);
      const r = convert(doc);
      const playback = new Map(channelsOf(r.playbackScore).map((t) => [t.name, t]));
      // M4 has program 3 on channel 3; M15 has program 14 on channel 15.
      expect([playback.get('M16')?.primary, playback.get('M17')?.primary]).toEqual([3, 3]);
      expect(playback.get('M18')?.primary).toBe(15);
      expect(playback.has('M19')).toBe(false); // program 20: no compatible channel
      expect(playback.has('M20')).toBe(false); // program 3 but bank 1: different bank
      const diagnostics = channelDiagnostics(r.losses);
      const byTrack = new Map(doc.tracks.map((t) => [t.id, t.name]));
      expect(diagnostics.map((l) => [byTrack.get(l.id), l.severity])).toEqual([
        ['M16', 'info'],
        ['M17', 'info'],
        ['M18', 'info'],
        ['M19', 'warning'],
        ['M20', 'warning'],
      ]);
    },
  );

  it('never shares while a free melodic channel remains (15 tracks with equal programs)', () => {
    const same = makeDoc(
      15,
      'none',
      Array.from({ length: 15 }, (): [number, number] => [0, 0]),
    );
    const primaries = channelsOf(toAlphaTabDirect(same, newSettings()).playbackScore).map(
      (t) => t.primary,
    );
    expect(new Set(primaries).size).toBe(15);
  });
});

describe('excluded tracks stay in the rendered notation', () => {
  it.each(strategies)(
    'Strategy %s: all 26 tracks are drawn from the Render Score',
    (_, convert) => {
      const doc = makeDoc(25, 'middle');
      const r = convert(doc);
      const rendered = renderScore(r.renderScore, newSettings());
      expect(rendered.error).toBeUndefined();
      expect(rendered.notes).toBe(26); // one note per track, excluded tracks included
    },
  );
});

describe('Render and Playback Scores are distinct types', () => {
  it('a Render Score cannot be passed to midiSummary (checked by tsc)', () => {
    const { renderScore: score } = toAlphaTabDirect(makeDoc(1, 'none'), newSettings());
    // @ts-expect-error a Render Score is not a Playback Score
    const unsafe = () => midiSummary(score, newSettings());
    expect(typeof unsafe).toBe('function');
  });
});
