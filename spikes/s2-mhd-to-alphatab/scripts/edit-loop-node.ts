// Spike S3 (ROADMAP S2-10): Node-only decomposition aid. Times the MHD edit, the Strategy A
// conversion (Render + Playback Score, finish()) and MIDI generation as alphaTab's
// loadMidiForScore (Render Score) and the S7 hook (Playback Score) do it, per document size,
// without a browser, renderer or player. NOT edit-loop latency: it isolates stages.
// Usage: `pnpm edit-loop-node`.
import * as alphaTab from '@coderline/alphatab';
import { canonical } from '../src/fixtures.ts';
import { generatePlaybackMidi } from '../src/playback-variants/hook.ts';
import { performanceDocument } from '../src/performance.ts';
import { newSettings } from '../src/run.ts';
import { toAlphaTabDirect } from '../src/strategy-a.ts';
import { editNote, notesOf } from '../src/edit-loop/edit.ts';
import { summarize } from '../src/edit-loop/stats.ts';

const docs = {
  small: canonical('band-repeats'),
  medium: performanceDocument(50),
  large: performanceDocument(300),
};
console.log(
  '| Document | Bars × tracks | n | Edit median / p95 | Convert median / p95 / max | Render-Score MIDI median / p95 | Playback-Score MIDI (hook) median / p95 |',
);
console.log('|---|---|---|---|---|---|---|');
for (const [name, start] of Object.entries(docs)) {
  let doc = start;
  const refs = notesOf(doc, 0).filter((n) => n.bar >= 2 && n.bar <= 9);
  const edits: number[] = [];
  const converts: number[] = [];
  const renderMidi: number[] = [];
  const playbackMidi: number[] = [];
  for (let i = 0; i < 33; i++) {
    const ref = refs[i % refs.length];
    if (!ref) throw new Error('no note');
    const t0 = performance.now();
    doc = editNote(doc, ref, i % 2 === 0 ? 1 : -1);
    const t1 = performance.now();
    const settings = newSettings();
    const conv = toAlphaTabDirect(doc, settings);
    const t2 = performance.now();
    const file = new alphaTab.midi.MidiFile();
    const generator = new alphaTab.midi.MidiFileGenerator(
      conv.renderScore,
      settings,
      new alphaTab.midi.AlphaSynthMidiFileHandler(file),
    );
    generator.applyTranspositionPitches = false;
    generator.generate();
    const t3 = performance.now();
    generatePlaybackMidi(conv.playbackScore, settings, file.tickShift);
    const t4 = performance.now();
    if (i >= 3) {
      edits.push(t1 - t0);
      converts.push(t2 - t1);
      renderMidi.push(t3 - t2);
      playbackMidi.push(t4 - t3);
    }
  }
  const e = summarize(edits);
  const c = summarize(converts);
  const rm = summarize(renderMidi);
  const pm = summarize(playbackMidi);
  console.log(
    `| ${name} | ${doc.masterBars.length} × ${doc.tracks.length} | ${c.n} | ${e.median.toFixed(2)} / ${e.p95.toFixed(2)} | ${c.median.toFixed(1)} / ${c.p95.toFixed(1)} / ${c.max.toFixed(1)} | ${rm.median.toFixed(1)} / ${rm.p95.toFixed(1)} | ${pm.median.toFixed(1)} / ${pm.p95.toFixed(1)} |`,
  );
}
