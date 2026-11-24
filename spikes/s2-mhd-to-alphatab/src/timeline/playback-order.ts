// Spike S5 (ROADMAP S2-06): independent playback order of MHD master bars.
// Works on MHD only; must not import alphaTab (checked by a test). Every rule is labelled:
// - [MHD]  defined by MUSIC_ENGINE.md §3.2–3.3 / the music-model README;
// - [CONV] standard notation convention that MHD does not spell out; chosen to match the parity
//          target (MUSIC_ENGINE.md §3.6, risk R6) and listed as an assumption in the report.
import type { MasterBar } from '@musichub/music-model';

export interface BarOccurrence {
  /** Master bar index. */
  bar: number;
  /** How many times this master bar was played before (0 = first time). */
  occurrence: number;
}

export interface PlaybackOrder {
  bars: BarOccurrence[];
  /** Labels of the [CONV] rules that this document actually needed. */
  assumptions: string[];
}

interface Section {
  start: number;
  end: number;
  count: number;
}

/**
 * [MHD] A repeat section ends at a bar with `repeatEnd` (count = total plays). It starts at the
 * nearest `repeatStart` after the previous section's end; without one it repeats "from the start
 * of the piece or the previous repeat end" (MUSIC_ENGINE.md §3.3 rule 7), i.e. the bar after the
 * previous section's end, or bar 0.
 */
function repeatSections(masterBars: readonly MasterBar[]): Section[] {
  const sections: Section[] = [];
  let from = 0;
  masterBars.forEach((mb, index) => {
    if (!mb.repeatEnd) return;
    let start = from;
    for (let i = index; i >= from; i--) {
      if (masterBars[i]?.repeatStart) {
        start = i;
        break;
      }
    }
    sections.push({ start, end: index, count: mb.repeatEnd.count });
    from = index + 1;
  });
  return sections;
}

/**
 * [MHD] Alternate-ending bars belong to the repeat closed in their group: consecutive bars with
 * endings, up to and after the closing bar, until a bar without endings or a new repeat start.
 */
function endingOwner(
  masterBars: readonly MasterBar[],
  sections: readonly Section[],
  index: number,
): Section | undefined {
  const inside = sections.find((s) => s.start <= index && index <= s.end);
  if (inside) return inside;
  // Bars after the closing bar that continue its ending group (e.g. ending 2 after ":|").
  for (let i = index - 1; i >= 0; i--) {
    const mb = masterBars[i];
    if (!mb?.alternateEndings || masterBars[i + 1]?.repeatStart) return undefined;
    const closed = sections.find((s) => s.end === i);
    if (closed) return closed;
  }
  return undefined;
}

const JUMPS = new Set([
  'daCapo',
  'daCapoAlFine',
  'daCapoAlCoda',
  'dalSegno',
  'dalSegnoAlFine',
  'dalSegnoAlCoda',
]);

export function playbackOrder(masterBars: readonly MasterBar[]): PlaybackOrder {
  const sections = repeatSections(masterBars);
  const assumptions = new Set<string>();
  const played = new Map<number, number>();
  const bars: BarOccurrence[] = [];
  /** Current pass (1-based) per section, set when the section is entered. */
  const pass = new Map<Section, number>();
  let activeJump: string | null = null;
  const takenJumps = new Set<number>();
  let index = 0;
  let guard = 0;

  const sectionOf = (i: number) => sections.find((s) => s.start <= i && i <= s.end);

  while (index < masterBars.length) {
    if (++guard > 100_000) throw new Error('playback order does not terminate');
    const mb = masterBars[index];
    if (!mb) break;
    const section = sectionOf(index);
    if (section && !pass.has(section)) {
      // [CONV] After a D.C./D.S. jump, repeats are not observed again: the final pass is played.
      if (activeJump) assumptions.add('repeats after a jump play only their final pass');
      pass.set(section, activeJump ? section.count : 1);
    }
    const owner = mb.alternateEndings ? endingOwner(masterBars, sections, index) : section;
    const currentPass = owner ? (pass.get(owner) ?? (activeJump ? owner.count : 1)) : 1;
    // [MHD] An ending bar is played only in the passes it lists.
    const isPlayed = !mb.alternateEndings || mb.alternateEndings.includes(currentPass);

    if (isPlayed) {
      const occurrence = played.get(index) ?? 0;
      played.set(index, occurrence + 1);
      bars.push({ bar: index, occurrence });
    }

    // Repeat back? [MHD] repeatEnd.count is the total number of plays.
    if (isPlayed && mb.repeatEnd && section && section.end === index) {
      const p = pass.get(section) ?? 1;
      if (p < section.count) {
        pass.set(section, p + 1);
        index = section.start;
        continue;
      }
    }

    // Directions are acted on after the bar has been played.
    const direction = mb.direction;
    if (isPlayed && direction) {
      // [CONV] A jump inside a repeated section is taken on its last pass only.
      const willRepeat = section !== undefined && (pass.get(section) ?? 1) < section.count;
      if (!activeJump && JUMPS.has(direction) && !takenJumps.has(index) && !willRepeat) {
        takenJumps.add(index);
        activeJump = direction;
        pass.clear();
        if (direction.startsWith('daCapo')) {
          index = 0; // [MHD] D.C. = from the beginning
        } else {
          // [MHD] D.S. = from the segno. [CONV] The nearest segno before the jump, else after it.
          let target = -1;
          for (let i = index; i >= 0; i--)
            if (masterBars[i]?.direction === 'segno') {
              target = i;
              break;
            }
          if (target === -1) target = masterBars.findIndex((m) => m.direction === 'segno');
          index = target;
        }
        continue;
      }
      if (activeJump?.endsWith('AlCoda') && direction === 'toCoda') {
        // [MHD] "al Coda": at "To Coda" go to the coda. [CONV] The first coda after this bar.
        let target = masterBars.findIndex((m, i) => i > index && m.direction === 'coda');
        if (target === -1) target = masterBars.findIndex((m) => m.direction === 'coda');
        activeJump = null;
        pass.clear();
        index = target;
        continue;
      }
      if (activeJump?.endsWith('AlFine') && direction === 'fine') break; // [MHD] "al Fine": stop
      // [CONV] "To Coda" and "Fine" are ignored before the jump. segnoSegno and doubleCoda are
      // only markers: no MHD v1 direction jumps to them.
      if (direction === 'segnoSegno' || direction === 'doubleCoda')
        assumptions.add(`${direction} is a marker without a jump in MHD v1`);
    }
    index++;
  }
  return { bars, assumptions: [...assumptions] };
}
