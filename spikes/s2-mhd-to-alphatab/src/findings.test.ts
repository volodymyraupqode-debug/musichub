// Pins down alphaTab 1.9.0 behaviour found in spike S2. Each test documents a fact the report relies on.
import * as alphaTab from '@coderline/alphatab';
import { describe, expect, it } from 'vitest';
import { beat, d, idSource } from './builders.ts';
import { canonical } from './fixtures.ts';
import { midiSummary } from './midi.ts';
import { newSettings } from './run.ts';
import { toAlphaTabDirect } from './strategy-a.ts';
import { toAlphaTabViaTex } from './strategy-b.ts';
import { SYNTHETIC_FIXTURES } from './synthetic.ts';

const both = (doc: Parameters<typeof toAlphaTabDirect>[0]) => [
  toAlphaTabDirect(doc, newSettings()).score,
  toAlphaTabViaTex(doc, newSettings()).score,
];

describe('alphaTab 1.9.0 model invariants (Strategy A)', () => {
  it('finish() crashes when bars of one staff have different voice counts', () => {
    const score = new alphaTab.model.Score();
    for (let i = 0; i < 2; i++) {
      const mb = new alphaTab.model.MasterBar();
      score.addMasterBar(mb);
    }
    const track = new alphaTab.model.Track();
    score.addTrack(track);
    track.ensureStaveCount(1);
    const staff = track.staves[0];
    if (!staff) throw new Error('no staff');
    staff.stringTuning.tunings = [];
    const voiceCounts = [2, 1];
    for (const count of voiceCounts) {
      const bar = new alphaTab.model.Bar();
      staff.addBar(bar);
      for (let v = 0; v < count; v++) {
        const voice = new alphaTab.model.Voice();
        bar.addVoice(voice);
        const b = new alphaTab.model.Beat();
        b.duration = 1;
        voice.addBeat(b);
      }
    }
    expect(() => score.finish(newSettings())).toThrow(TypeError);
  });

  it('an alphaTex import resets the global id counters, so ids of two live Scores collide', () => {
    const doc = canonical('band-repeats');
    const a = toAlphaTabDirect(doc, newSettings()).score;
    const b = toAlphaTabViaTex(doc, newSettings()).score;
    const firstBarId = (s: alphaTab.model.Score) => s.tracks[0]?.staves[0]?.bars[0]?.id;
    const ids = (s: alphaTab.model.Score) =>
      s.tracks.flatMap((t) => t.staves.flatMap((st) => st.bars.map((bar) => bar.id)));
    expect(firstBarId(b)).toBe(0); // reset by the importer
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(true);
    expect(new Set(ids(a)).size).toBe(ids(a).length); // unique within one Score when builds do not interleave
  });

  it('alphaTab element ids are global counters, different for every new Score', () => {
    const doc = canonical('guitar-basic');
    const first = toAlphaTabDirect(doc, newSettings()).score;
    const second = toAlphaTabDirect(doc, newSettings()).score;
    const firstBeat = first.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
    const secondBeat = second.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0];
    expect(firstBeat?.id).not.toBe(secondBeat?.id);
  });
});

describe('alphaTab semantics shared by both strategies', () => {
  it('normalises the value of a single grace beat to an eighth and takes its time from the previous beat', () => {
    for (const score of both(canonical('guitar-basic'))) {
      const grace = score.tracks[0]?.staves[0]?.bars[2]?.voices[0]?.beats[0];
      expect(grace?.graceType).toBe(2);
      expect(grace?.duration).toBe(8); // MHD value 16
      const restBefore = score.tracks[0]?.staves[0]?.bars[1]?.voices[0]?.beats[5];
      expect(restBefore?.playbackDuration).toBe(960 - 120);
    }
  });

  it('truncates tuplet ticks that PPQ 960 cannot represent (7:8 sixteenths)', () => {
    const doc = SYNTHETIC_FIXTURES.rhythm?.();
    if (!doc) throw new Error('fixture missing');
    for (const score of both(doc)) {
      const septuplet = score.tracks[0]?.staves[0]?.bars[6]?.voices[0]?.beats[0];
      expect(septuplet?.playbackDuration).toBe(274); // exact: 274.2857…
    }
  });

  it('plays a half-open hi-hat as GM 46 (open) and has no rimshot for GM 40', () => {
    const doc = SYNTHETIC_FIXTURES.percussion?.();
    if (!doc) throw new Error('fixture missing');
    for (const score of both(doc)) {
      const beats = score.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats ?? [];
      expect(beats[0]?.notes[0]?.realValue).toBe(46); // MHD 42 + halfOpen
      expect(beats[1]?.notes[0]?.realValue).toBe(46); // MHD 46 + halfOpen: same articulation 92
      expect(beats[6]?.notes[0]?.realValue).toBe(40); // MHD 40 + rimshot: plain electric snare
    }
  });

  it('generates no sustain pedal (CC 64) MIDI events although the pedal is in the model', () => {
    const doc = canonical('piano-grand-staff');
    for (const score of both(doc)) {
      const pedals = score.tracks[0]?.staves[1]?.bars.flatMap((b) => b.sustainPedals) ?? [];
      expect(pedals.length).toBeGreaterThan(0);
      expect(midiSummary(score, newSettings()).sustainEvents).toBe(0);
    }
  });

  it('accepts alternate endings above 8 in the bitmask (MasterBar.MaxAlternateEndings is 8)', () => {
    const doc = SYNTHETIC_FIXTURES.repeats?.();
    if (!doc) throw new Error('fixture missing');
    for (const score of both(doc)) {
      expect(score.masterBars[7]?.alternateEndings).toBe((1 << 8) | (1 << 9));
    }
  });
});

describe('alphaTex pitfalls (Strategy B)', () => {
  it('reads unparenthesised metadata arguments greedily', () => {
    const tex =
      '\\track "P" { instrument 0 }\n\\staff { score }\n\\section "Groove" D#4{acc default}.1';
    expect(() => alphaTab.importer.ScoreLoader.loadAlphaTex(tex, newSettings())).toThrow();
    const ok =
      '\\track "P" { instrument 0 }\n\\staff { score }\n\\section ("Groove") D#4{acc default}.1';
    expect(
      alphaTab.importer.ScoreLoader.loadAlphaTex(ok, newSettings()).masterBars[0]?.section?.text,
    ).toBe('Groove');
  });

  it('parses a lone number on a percussion staff as fret.string', () => {
    const lone = '\\track "D" { instrument percussion }\n\\staff { score }\n92.8';
    expect(() => alphaTab.importer.ScoreLoader.loadAlphaTex(lone, newSettings())).toThrow();
    const chord = '\\track "D" { instrument percussion }\n\\staff { score }\n(92).8';
    expect(
      alphaTab.importer.ScoreLoader.loadAlphaTex(chord, newSettings()).tracks[0]?.staves[0]?.bars[0]
        ?.voices[0]?.beats[0]?.notes[0]?.realValue,
    ).toBe(46);
  });

  it('forces an accidental mode from a pitch name unless reset with {acc default}', () => {
    const score = alphaTab.importer.ScoreLoader.loadAlphaTex(
      '\\track "P" { instrument 0 }\n\\staff { score }\nC#4.4 C#4{acc default}.4',
      newSettings(),
    );
    const beats = score.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats ?? [];
    expect(beats[0]?.notes[0]?.accidentalMode).toBe(3);
    expect(beats[1]?.notes[0]?.accidentalMode).toBe(0);
  });

  it('spaces `tb` whammy values evenly; exact offsets need `tbe`', () => {
    const load = (prop: string) =>
      alphaTab.importer.ScoreLoader.loadAlphaTex(
        `\\track "G" { instrument 25 }\n\\staff { tabs }\n3.6{${prop} (custom 0 0 60 -8)}.4`,
        newSettings(),
      ).tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.whammyBarPoints?.map((p) => p.offset);
    expect(load('tb')).not.toEqual([0, 60]);
    expect(load('tbe')).toEqual([0, 60]);
  });

  it('reports invalid input with line and column of the generated text; Strategy A accepts it silently', () => {
    const doc = canonical('guitar-basic');
    const note = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[1]?.notes[0];
    if (!note) throw new Error('fixture changed');
    note.string = 7; // invalid: the staff has 6 strings (validateDocument rejects it)
    expect(() => toAlphaTabDirect(doc, newSettings())).not.toThrow();
    let diagnostics: string[] = [];
    try {
      toAlphaTabViaTex(doc, newSettings());
    } catch (e) {
      const err = e as {
        semanticDiagnostics?: { items: { code: number; start?: { line: number; col: number } }[] };
      };
      diagnostics = (err.semanticDiagnostics?.items ?? []).map(
        (x) => `AT${x.code}@${x.start?.line}:${x.start?.col}`,
      );
    }
    expect(diagnostics).toEqual([expect.stringMatching(/^AT208@\d+:\d+$/)]);
  });

  it('keeps a builder id source deterministic', () => {
    const id = idSource('XX');
    expect(beat(id, d(4), [{ pitch: 60 }]).id).toBe('XX0000000001');
  });
});
