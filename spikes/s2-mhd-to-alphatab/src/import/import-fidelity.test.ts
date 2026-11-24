// Spike S4 (ROADMAP S2-09): import fidelity of the hand-authored MusicXML fixtures through
// alphaTab 1.9.0 → MHD (spike converter) → GP7 round trip. Every deviation from the intended
// content is listed here explicitly; anything else must match exactly.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as alphaTab from '@coderline/alphatab';
import { validateDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { newSettings } from '../run.ts';
import { toAlphaTabDirect } from '../strategy-a.ts';
import {
  FIXTURE_DIR,
  compareDocuments,
  compareGroup,
  compareScores,
  compareWithIntent,
  importFixture,
  type GroupResult,
  type Status,
} from './evaluate.ts';
import { fromAlphaTab } from './from-alphatab.ts';
import { intents } from './intent.ts';

type Known = Record<string, Partial<Record<string, Status>>>;

/** Import (alphaTab) and MHD conversion: the only groups that differ from the intent. */
const KNOWN_IMPORT: Known = {
  // `<sound dalsegno>` with the words "D.S. al Coda" becomes plain Dal Segno (code 9, not 10).
  'mx07-repeats-navigation': { directions: 'partial' },
  // The part name's space becomes U+00A0 (no-break space) on import.
  'mx08-guitar-tab': { trackInfo: 'unsupported' },
};
/** Conversion losses expected per fixture (besides `track.instrument.family`, which is always one). */
const KNOWN_LOSSES: Record<string, string[]> = { 'mx06-articulations': ['note.accent.tenuto'] };
/** GP7 round trip: Gp7Exporter + Gp7To8Importer give non-stringed staves a tuning and string/fret. */
const STRINGED_AFTER_ROUND_TRIP = new Set(['tuning', 'pitch']);

const deviations = (results: GroupResult[]) =>
  Object.fromEntries(
    results
      .filter((r) => r.status !== 'supported' && r.status !== 'not exercised')
      .map((r) => [r.group, r.status]),
  );

describe('fixture inventory', () => {
  const sources = readFileSync(path.join(FIXTURE_DIR, 'SOURCES.md'), 'utf8');
  const files = readdirSync(path.join(FIXTURE_DIR, 'musicxml')).sort();

  it('every fixture file has an intent and a SOURCES.md entry with its SHA-256', () => {
    expect(files.map((f) => f.replace(/\.musicxml$/, ''))).toEqual(
      intents()
        .map((i) => i.name)
        .sort(),
    );
    for (const f of files) {
      const sha = createHash('sha256')
        .update(readFileSync(path.join(FIXTURE_DIR, 'musicxml', f)))
        .digest('hex');
      expect(sources).toContain(`\`musicxml/${f}\` | \`${sha}\``);
    }
  });

  it('contains no Guitar Pro files and no files from other sources', () => {
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual(['SOURCES.md', 'musicxml']);
  });
});

describe.each(intents().map((i) => [i.name, i] as const))('%s', (name, intent) => {
  const imported = importFixture(`musicxml/${name}.musicxml`);
  const converted = fromAlphaTab(imported, intent.doc.id);

  it('intent is valid MHD v1', () => {
    expect(validateDocument(intent.doc).valid).toBe(true);
  });

  it('alphaTab import matches the intent except the documented findings', () => {
    expect(deviations(compareWithIntent(intent.doc, imported))).toEqual(KNOWN_IMPORT[name] ?? {});
  });

  it('the converted MHD is valid and matches the intent except the documented findings', () => {
    const v = validateDocument(converted.doc);
    expect(v.issues).toEqual([]);
    expect(v.valid).toBe(true);
    expect(deviations(compareDocuments(intent.doc, converted.doc))).toEqual(
      KNOWN_IMPORT[name] ?? {},
    );
  });

  it('conversion reports its losses, never drops them', () => {
    expect([...new Set(converted.losses.map((l) => l.feature))].sort()).toEqual(
      ['track.instrument.family', ...(KNOWN_LOSSES[name] ?? [])].sort(),
    );
  });

  it('GP7 round trip (MHD → alphaTab → Gp7Exporter → Gp7To8Importer) keeps the musical content', () => {
    const score = toAlphaTabDirect(converted.doc, newSettings()).renderScore;
    const bytes = new alphaTab.exporter.Gp7Exporter().export(score, newSettings());
    const back = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, newSettings());
    const d = deviations(compareScores(imported, back));
    const stringed = imported.tracks.every((t) => t.staves.every((s) => s.isStringed));
    expect(d).toEqual(
      stringed
        ? {}
        : Object.fromEntries([...STRINGED_AFTER_ROUND_TRIP].map((g) => [g, 'unsupported'])),
    );
  });
});

describe('documented findings', () => {
  it('mx07: D.S. al Coda is imported as Dal Segno', () => {
    const score = importFixture('musicxml/mx07-repeats-navigation.musicxml');
    expect(score.masterBars.map((m) => [...(m.directions ?? [])])).toEqual([
      [],
      [],
      [],
      [alphaTab.model.Direction.TargetSegno],
      [alphaTab.model.Direction.JumpDaCoda],
      [alphaTab.model.Direction.JumpDalSegno],
      [alphaTab.model.Direction.TargetCoda],
    ]);
  });

  it('mx08: the part name gets a no-break space', () => {
    expect(importFixture('musicxml/mx08-guitar-tab.musicxml').tracks[0]?.name).toBe(
      'Acoustic Guitar',
    );
  });

  it('mx06: tenuto is imported (AccentuationType.Tenuto) but MHD v1 cannot hold it', () => {
    const beats =
      importFixture('musicxml/mx06-articulations.musicxml').tracks[0]?.staves[0]?.bars[0]?.voices[0]
        ?.beats ?? [];
    expect(beats.map((b) => b.notes[0]?.accentuated)).toEqual([
      alphaTab.model.AccentuationType.None,
      alphaTab.model.AccentuationType.Normal,
      alphaTab.model.AccentuationType.Heavy,
      alphaTab.model.AccentuationType.Tenuto,
    ]);
    expect(intents().find((i) => i.name === 'mx06-articulations')?.notInMhd).toEqual([
      'tenuto (bar 1, beat 4)',
    ]);
  });

  it('mx05: dynamics p, mf, ff arrive on the intended beats', () => {
    const intent = intents().find((i) => i.name === 'mx05-tempo-dynamics');
    const bars =
      importFixture('musicxml/mx05-tempo-dynamics.musicxml').tracks[0]?.staves[0]?.bars ?? [];
    const value = {
      p: alphaTab.model.DynamicValue.P,
      mf: alphaTab.model.DynamicValue.MF,
      ff: alphaTab.model.DynamicValue.FF,
    } as const;
    for (const d of intent?.dynamics ?? [])
      expect(bars[d.bar]?.voices[0]?.beats[d.beat]?.dynamics).toBe(
        value[d.value as keyof typeof value],
      );
  });

  it('GP7 round trip: sounding pitches stay, a piano staff comes back with a guitar tuning', () => {
    const doc = fromAlphaTab(
      importFixture('musicxml/mx01-notes-rests.musicxml'),
      intents()[0]?.doc.id ?? '',
    ).doc;
    const score = toAlphaTabDirect(doc, newSettings()).renderScore;
    const back = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
      new alphaTab.exporter.Gp7Exporter().export(score, newSettings()),
      newSettings(),
    );
    expect(score.tracks[0]?.staves[0]?.isStringed).toBe(false);
    expect(back.tracks[0]?.staves[0]?.tuning).toEqual([64, 59, 55, 50, 45, 40]);
  });
});

describe('comparison', () => {
  it('classifies groups as supported, partial, unsupported or not exercised', () => {
    expect(compareGroup('g', [[1], [2]], [[1], [2]]).status).toBe('supported');
    expect(compareGroup('g', [[1], [2]], [[1], [3]]).status).toBe('partial');
    expect(compareGroup('g', [[1]], [[2]]).status).toBe('unsupported');
    expect(compareGroup('g', [], []).status).toBe('not exercised');
    expect(compareGroup('g', [], [[1]]).status).toBe('unsupported');
  });

  it('detects a wrong expectation (negative control)', () => {
    const intent = structuredClone(intents()[0]);
    if (!intent) throw new Error('intent missing');
    const note = intent.doc.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[0]?.notes[0];
    if (!note) throw new Error('note missing');
    note.pitch = (note.pitch ?? 0) + 1;
    const d = deviations(
      compareWithIntent(intent.doc, importFixture('musicxml/mx01-notes-rests.musicxml')),
    );
    expect(d.pitch).toBe('partial');
    expect(d.soundingPitch).toBe('partial');
  });
});
