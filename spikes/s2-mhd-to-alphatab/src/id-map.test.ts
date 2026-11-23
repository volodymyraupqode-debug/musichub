import * as alphaTab from '@coderline/alphatab';
import type { MhdDocument } from '@musichub/music-model';
import { describe, expect, it } from 'vitest';
import { allDocuments, canonical } from './fixtures.ts';
import { recoverIdMap } from './id-map.ts';
import { newSettings } from './run.ts';
import { toAlphaTabDirect } from './strategy-a.ts';
import { toAlphaTabViaTex } from './strategy-b.ts';

function mhdIds(doc: MhdDocument): string[] {
  const ids = doc.masterBars.map((m) => m.id);
  for (const t of doc.tracks) {
    ids.push(t.id);
    for (const s of t.staves) {
      ids.push(s.id);
      for (const b of s.bars) {
        ids.push(b.id);
        for (const v of b.voices) {
          ids.push(v.id);
          for (const bt of v.beats) {
            ids.push(bt.id);
            for (const n of bt.notes) ids.push(n.id);
          }
        }
      }
    }
  }
  return ids;
}

/** A comparable signature of an alphaTab object, independent of object identity. */
function signature(obj: object): string {
  if (obj instanceof alphaTab.model.Note)
    return `note ${obj.realValueWithoutHarmonic} ${obj.string} ${obj.fret} ${obj.beat.absolutePlaybackStart}`;
  if (obj instanceof alphaTab.model.Beat)
    return `beat ${obj.absolutePlaybackStart} ${obj.duration} ${obj.notes.length}`;
  if (obj instanceof alphaTab.model.Voice) return `voice ${obj.bar.index} ${obj.index}`;
  if (obj instanceof alphaTab.model.Bar)
    return `bar ${obj.staff.track.index} ${obj.staff.index} ${obj.index}`;
  if (obj instanceof alphaTab.model.Staff) return `staff ${obj.track.index} ${obj.index}`;
  if (obj instanceof alphaTab.model.Track) return `track ${obj.index}`;
  if (obj instanceof alphaTab.model.MasterBar) return `masterBar ${obj.index}`;
  return 'unknown';
}

describe.each(allDocuments(true))('id map — $name', ({ doc }) => {
  const ids = mhdIds(doc);
  const a = toAlphaTabDirect(doc, newSettings());
  const b = toAlphaTabViaTex(doc, newSettings());
  const recovered = recoverIdMap(doc, b.renderScore as never);

  it('Strategy A maps every MHD element while building', () => {
    expect(a.idMap.byId.size).toBe(ids.length);
    for (const id of ids) expect(a.idMap.mhdIdOf(a.idMap.get(id) ?? {})).toBe(id);
  });

  it('Strategy B ids can be recovered by a parallel walk; both maps point at equivalent objects', () => {
    expect(recovered.unmatched).toEqual([]);
    expect(recovered.idMap.byId.size).toBe(ids.length);
    for (const id of ids) {
      const objA = a.idMap.get(id);
      const objB = recovered.idMap.get(id);
      if (!objA || !objB) throw new Error(`unmapped ${id}`);
      expect(signature(objB)).toBe(signature(objA));
    }
  });
});

describe('id map behaviour across rebuilds and edits', () => {
  it('maps a rendered beat (boundsLookup hit) back to its MHD id', () => {
    const doc = canonical('band-repeats');
    const { renderScore: score, idMap } = toAlphaTabDirect(doc, newSettings());
    const renderer = new alphaTab.rendering.ScoreRenderer(newSettings());
    renderer.width = 1300;
    renderer.renderScore(
      score,
      score.tracks.map((t) => t.index),
    );
    const hits = (renderer.boundsLookup?.staffSystems ?? []).flatMap((s) =>
      s.bars.flatMap((mb) => mb.bars.flatMap((bar) => bar.beats)),
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) expect(idMap.mhdIdOf(hit.beat)).toMatch(/^BC/);
  });

  it('a rebuilt Score gets new objects and alphaTab ids, but the MHD ids resolve again', () => {
    const doc = canonical('guitar-basic');
    const first = toAlphaTabDirect(doc, newSettings());
    const second = toAlphaTabDirect(doc, newSettings());
    const id = 'GA0000000105';
    const beatA = first.idMap.get<alphaTab.model.Note>(id);
    const beatB = second.idMap.get<alphaTab.model.Note>(id);
    expect(beatA).not.toBe(beatB);
    expect(beatA?.id).not.toBe(beatB?.id);
    expect(signature(beatB ?? {})).toBe(signature(beatA ?? {}));
    // The old map does not know the new objects: maps are per Score.
    expect(first.idMap.mhdIdOf(beatB ?? {})).toBeUndefined();
  });

  it('after an edit, a positional key points at a different beat while the MHD id still resolves', () => {
    const doc = canonical('guitar-basic');
    const before = toAlphaTabDirect(doc, newSettings());
    const voice = doc.tracks[0]?.staves[0]?.bars[0]?.voices[0];
    if (!voice?.beats[0]) throw new Error('fixture changed');
    // Edit: split the first quarter into two eighths (a new beat is inserted at index 0).
    const first = voice.beats[0];
    voice.beats.splice(
      0,
      1,
      {
        ...first,
        id: 'GAedit000001',
        duration: { value: 8, dots: 0 },
        notes: [{ id: 'GAedit000002', string: 3, fret: 2 }],
      },
      { ...first, duration: { value: 8, dots: 0 } },
    );
    const afterA = toAlphaTabDirect(doc, newSettings());
    const afterB = recoverIdMap(doc, toAlphaTabViaTex(doc, newSettings()).renderScore as never);
    const positional = (s: alphaTab.model.Score) =>
      s.tracks[0]?.staves[0]?.bars[0]?.voices[0]?.beats[1];
    // Positional key "track 0 / staff 0 / bar 0 / voice 0 / beat 1" now names the moved original beat.
    expect(before.idMap.mhdIdOf(positional(before.renderScore) ?? {})).toBe('GA0000000104');
    expect(afterA.idMap.mhdIdOf(positional(afterA.renderScore) ?? {})).toBe(first.id);
    // A freshly built (A) or freshly recovered (B) map resolves every id, including the new beat.
    for (const map of [afterA.idMap, afterB.idMap]) {
      expect(map.get('GAedit000001')).toBeInstanceOf(alphaTab.model.Beat);
      expect(map.get<alphaTab.model.Beat>(first.id)?.playbackStart).toBe(480);
    }
  });
});
