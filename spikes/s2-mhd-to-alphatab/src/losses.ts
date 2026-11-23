/**
 * Diagnostic codes of the approved conversion contract (decision Q-B, S2-05 review). The spike
 * records them on its losses; the full contract is implemented in Phase 1.
 */
export type DiagnosticCode =
  | 'invalid-document'
  | 'unsupported'
  | 'approximated'
  | 'render-limited'
  | 'playback-ignored'
  | 'engine-policy'
  | 'extension-ignored';

/** A known transformation or loss recorded by a converter for one MHD element. */
export interface Loss {
  /** MHD feature path, e.g. `note.velocity` or `drumTechnique.rimshot`. */
  feature: string;
  /** MHD id of the element. */
  id: string;
  detail: string;
  /** Q-B contract fields; set by the checks added after the review (fermatas). */
  code?: DiagnosticCode;
  severity?: 'info' | 'warning' | 'error';
  aspect?: 'notation' | 'playback' | 'export' | 'all';
}

/** Losses grouped by feature with the number of affected elements. */
export function summarizeLosses(losses: readonly Loss[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of losses) out.set(l.feature, (out.get(l.feature) ?? 0) + 1);
  return out;
}
