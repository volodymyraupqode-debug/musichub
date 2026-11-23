// Experimental MHD id ↔ alphaTab object map (MUSIC_ENGINE.md §4.1: `{ score, idMap }`).
// alphaTab ids (`Beat.id`, `Note.id`, `Bar.id`, `Voice.id`) are global counters that change with
// every new Score, so they can never serve as a stable key; the map is keyed by object identity.

export interface IdMap {
  /** alphaTab object → MHD id. Weak, so a discarded Score is collectable. */
  readonly toMhd: WeakMap<object, string>;
  /** MHD id → alphaTab object of the current Score. */
  readonly byId: Map<string, object>;
  set(obj: object, mhdId: string): void;
  mhdIdOf(obj: object): string | undefined;
  get<T extends object>(mhdId: string): T | undefined;
}

export function createIdMap(): IdMap {
  const toMhd = new WeakMap<object, string>();
  const byId = new Map<string, object>();
  return {
    toMhd,
    byId,
    set(obj, mhdId) {
      toMhd.set(obj, mhdId);
      byId.set(mhdId, obj);
    },
    mhdIdOf: (obj) => toMhd.get(obj),
    get: <T extends object>(mhdId: string) => byId.get(mhdId) as T | undefined,
  };
}

/** Minimal structural view of alphaTab objects needed for positional recovery. */
interface AtScore {
  masterBars: object[];
  tracks: {
    staves: { bars: { voices: { beats: { isEmpty: boolean; notes: object[] }[] }[] }[] }[];
  }[];
}
interface MhdView {
  masterBars: { id: string }[];
  tracks: {
    id: string;
    staves: {
      id: string;
      bars: {
        id: string;
        voices: { id: string; beats: { id: string; notes: { id: string }[] }[] }[];
      }[];
    }[];
  }[];
}

/**
 * Rebuilds the id map of a Score that was not built object by object (Strategy B) by walking MHD
 * and alphaTab in parallel: track, staff, bar, voice, beat and note indexes. Placeholder voices and
 * beats (`isEmpty`) have no MHD counterpart. Returns the number of MHD elements without a partner.
 */
export function recoverIdMap(doc: MhdView, score: AtScore): { idMap: IdMap; unmatched: string[] } {
  const idMap = createIdMap();
  const unmatched: string[] = [];
  const pair = (obj: object | undefined, id: string) =>
    obj ? idMap.set(obj, id) : unmatched.push(id);
  doc.masterBars.forEach((mb, i) => pair(score.masterBars[i], mb.id));
  doc.tracks.forEach((t, ti) => {
    const track = score.tracks[ti];
    pair(track, t.id);
    t.staves.forEach((s, si) => {
      const staff = track?.staves[si];
      pair(staff, s.id);
      s.bars.forEach((b, bi) => {
        const bar = staff?.bars[bi];
        pair(bar, b.id);
        b.voices.forEach((v, vi) => {
          const voice = bar?.voices[vi];
          pair(voice, v.id);
          const beats = (voice?.beats ?? []).filter((x) => !x.isEmpty);
          v.beats.forEach((bt, bti) => {
            const beat = beats[bti];
            pair(beat, bt.id);
            bt.notes.forEach((n, ni) => pair(beat?.notes[ni], n.id));
          });
        });
      });
    });
  });
  return { idMap, unmatched };
}
