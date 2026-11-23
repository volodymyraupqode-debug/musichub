// Decisions Q-D (Bar.ottava = display-only octave line, alphaTab Beat.ottava) and Q-E (positioned
// fermatas, never rounded or moved) in both strategies.
import * as alphaTab from '@coderline/alphatab';
import { validateDocument, type MhdDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { midiSummary } from './midi.ts';
import { newSettings } from './run.ts';
import { toAlphaTabDirect } from './strategy-a.ts';
import { toAlphaTabViaTex } from './strategy-b.ts';
import { SYNTHETIC_FIXTURES } from './synthetic.ts';

function fixture(): MhdDocument {
  const make = SYNTHETIC_FIXTURES['fermatas-ottava'];
  if (!make) throw new Error('fixture missing');
  return make();
}

const strategies = [
  ['A', (doc: MhdDocument) => toAlphaTabDirect(doc, newSettings())],
  ['B', (doc: MhdDocument) => toAlphaTabViaTex(doc, newSettings())],
] as const;

/** [master bar, tick, FermataType] of every fermata in the Score. */
function fermatas(score: alphaTab.model.Score): number[][] {
  return score.masterBars.flatMap((m) =>
    [...(m.fermata?.entries() ?? [])].map(([tick, f]) => [m.index, tick, f.type]),
  );
}

function beatsOf(score: alphaTab.model.Score, barIndex: number): alphaTab.model.Beat[] {
  return score.tracks[0]?.staves[0]?.bars[barIndex]?.voices[0]?.beats ?? [];
}

describe('fixture', () => {
  it('is valid MHD v1 with exactly the intended fermata-not-on-beat warning', () => {
    const result = validateDocument(fixture());
    expect(result.valid).toBe(true);
    expect(result.issues.map((i) => `${i.severity}:${i.code}@${i.path.join('.')}`)).toEqual([
      'warning:fermata-not-on-beat@masterBars.2.fermatas.0.position',
    ]);
  });
});

describe.each(strategies)('Strategy %s', (_, convert) => {
  const doc = fixture();
  const before = structuredClone(doc);
  const result = convert(doc);
  const score = result.score;

  it('places representable fermatas at their exact tick with the mapped type', () => {
    // Bar 0: standard at 0 → Medium (1). Bar 1: short at 1/4 (960) → Short (0), long at 3/4 (2880) → Long (2).
    expect(fermatas(score)).toEqual([
      [0, 0, 1],
      [1, 960, 0],
      [1, 2880, 2],
    ]);
    expect(beatsOf(score, 1).map((b) => b.fermata?.type ?? null)).toEqual([null, 0, null, 2]);
  });

  it('never rounds or moves a fermata: no beat start or no whole tick → diagnostic, no fermata', () => {
    expect(beatsOf(score, 2).some((b) => b.fermata)).toBe(false); // [1, 8] = tick 480, no beat there
    expect(beatsOf(score, 3).some((b) => b.fermata)).toBe(false); // [1, 7] = tick 548.57…
    const diagnostics = result.losses.filter((l) => l.feature === 'masterBar.fermatas.position');
    expect(diagnostics.map((l) => [l.id, l.code, l.severity, l.aspect])).toEqual([
      [doc.masterBars[2]?.id, 'unsupported', 'warning', 'notation'],
      [doc.masterBars[3]?.id, 'unsupported', 'warning', 'notation'],
    ]);
  });

  it('leaves the MHD document (fermata positions included) unchanged', () => {
    expect(doc).toEqual(before);
  });

  it('maps Bar.ottava to Beat.ottava on every beat of the bar only, never to the clef ottava', () => {
    const regular = 2;
    expect(beatsOf(score, 4).map((b) => [b.graceType, b.ottava])).toEqual([
      [2, 1], // grace beat, 8va
      [0, 1],
      [0, 1],
      [0, 1],
      [0, 1],
    ]);
    expect(beatsOf(score, 5).map((b) => b.ottava)).toEqual([4, 4]); // 15mb
    expect(beatsOf(score, 6).map((b) => b.ottava)).toEqual([regular]); // not carried forward
    for (const bar of score.tracks[0]?.staves[0]?.bars ?? []) expect(bar.clefOttava).toBe(regular);
  });
});

describe('fermata diagnostics', () => {
  it('are identical in Strategy A and Strategy B (code, severity, aspect, id, feature, detail)', () => {
    const [a, b] = strategies.map(([, convert]) =>
      convert(fixture()).losses.filter((l) => l.feature === 'masterBar.fermatas.position'),
    );
    expect(a).toHaveLength(2);
    expect(b).toEqual(a);
    expect(a?.every((l) => l.code === 'unsupported')).toBe(true);
  });
});

describe('ottava is display-only', () => {
  const withOttava = fixture();
  const withoutOttava = structuredClone(withOttava);
  for (const bar of withoutOttava.tracks[0]?.staves[0]?.bars ?? []) delete bar.ottava;

  it.each(strategies)(
    'Strategy %s: MIDI note events are identical with and without ottava',
    (_, convert) => {
      // Only note on/off events (tick, channel, key, velocity): what sounds.
      const notes = (doc: MhdDocument) =>
        midiSummary(convert(doc).score, newSettings()).events.filter((e) => /^(on|off) /.test(e));
      const a = notes(withOttava);
      expect(a.length).toBeGreaterThan(0);
      expect(notes(withoutOttava)).toEqual(a);
      // The stored sounding pitch is what alphaTab plays.
      const pitches = (doc: MhdDocument) =>
        beatsOf(convert(doc).score, 4).flatMap((b) => b.notes.map((n) => n.realValue));
      expect(pitches(withOttava)).toEqual([86, 88, 89, 91, 93]);
      expect(pitches(withoutOttava)).toEqual([86, 88, 89, 91, 93]);
    },
  );

  it('changes the written position in the rendered notation', () => {
    // Note heads under 8va are drawn an octave lower (larger y), under 15mb two octaves higher.
    const noteHeadY = (doc: MhdDocument, barIndex: number) => {
      const settings = newSettings();
      settings.core.includeNoteBounds = true;
      const renderer = new alphaTab.rendering.ScoreRenderer(settings);
      renderer.width = 1300;
      const score = toAlphaTabDirect(doc, newSettings()).score;
      renderer.renderScore(score, [0]);
      const bars = (renderer.boundsLookup?.staffSystems ?? []).flatMap((s) => s.bars);
      const beats = bars.find((b) => b.index === barIndex)?.bars[0]?.beats ?? [];
      return beats.flatMap((b) => (b.notes ?? []).map((n) => n.noteHeadBounds.y));
    };
    const with8va = noteHeadY(withOttava, 4);
    const without8va = noteHeadY(withoutOttava, 4);
    expect(with8va).toHaveLength(5);
    with8va.forEach((y, i) => expect(y).toBeGreaterThan(without8va[i] ?? Infinity));
    const with15mb = noteHeadY(withOttava, 5);
    const without15mb = noteHeadY(withoutOttava, 5);
    with15mb.forEach((y, i) => expect(y).toBeLessThan(without15mb[i] ?? -Infinity));
  });
});
