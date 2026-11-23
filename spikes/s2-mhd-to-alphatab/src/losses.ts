/** A known transformation or loss recorded by a converter for one MHD element. */
export interface Loss {
  /** MHD feature path, e.g. `note.velocity` or `drumTechnique.rimshot`. */
  feature: string;
  /** MHD id of the element. */
  id: string;
  detail: string;
}

/** Losses grouped by feature with the number of affected elements. */
export function summarizeLosses(losses: readonly Loss[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of losses) out.set(l.feature, (out.get(l.feature) ?? 0) + 1);
  return out;
}
