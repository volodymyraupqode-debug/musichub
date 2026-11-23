// All S2 input documents: the three canonical MHD fixtures (read from packages/music-model, never
// modified), the synthetic set and the performance document.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { MhdDocument } from '@musichub/music-model';
import { performanceDocument } from './performance.ts';
import { SYNTHETIC_FIXTURES } from './synthetic.ts';

export const CANONICAL_DIR = path.resolve(
  import.meta.dirname,
  '../../../packages/music-model/fixtures/v1',
);
export const CANONICAL = ['guitar-basic', 'piano-grand-staff', 'band-repeats'] as const;

export function canonical(name: (typeof CANONICAL)[number]): MhdDocument {
  return JSON.parse(
    readFileSync(path.join(CANONICAL_DIR, `${name}.mhd.json`), 'utf8'),
  ) as MhdDocument;
}

export interface NamedDocument {
  name: string;
  kind: 'canonical' | 'synthetic' | 'performance';
  doc: MhdDocument;
}

export function allDocuments(includePerformance = false): NamedDocument[] {
  const docs: NamedDocument[] = [
    ...CANONICAL.map((name) => ({ name, kind: 'canonical' as const, doc: canonical(name) })),
    ...Object.entries(SYNTHETIC_FIXTURES).map(([name, make]) => ({
      name,
      kind: 'synthetic' as const,
      doc: make(),
    })),
  ];
  if (includePerformance)
    docs.push({ name: 'performance-300x8', kind: 'performance', doc: performanceDocument() });
  return docs;
}
