/**
 * Shapes of the three snapshots under `public/data/science/`, written by
 * `app/scripts/fetch-science.py`. Re-run that script to refresh them; nothing here fetches live.
 *
 * Each file carries a `captured` timestamp, which the pages show — these are point-in-time counts
 * from public databases, not live queries, and they drift.
 */

export interface Captured {
  /** ISO-8601 UTC instant the snapshot was taken. */
  captured: string;
}

// ── /science/trials ──────────────────────────────────────────────────────────────────────────
export interface TrialBucket { phase?: string; status?: string; count: number }

export interface TrialCondition {
  key: string;
  label: string;
  /** The Kong programme this indication belongs to. */
  programme: string;
  total: number;
  phases: { phase: string; count: number }[];
  statuses: { status: string; count: number }[];
}

export interface RecentTrial {
  condition: string;
  nctId: string;
  title: string;
  phase: string;
  status: string;
  sponsor: string;
  enrollment: number | null;
  start: string | null;
}

export interface TrialsSnapshot extends Captured {
  conditions: TrialCondition[];
  recent: RecentTrial[];
}

// ── /science/rac1 ────────────────────────────────────────────────────────────────────────────
/** Open Targets splits an association score by the kind of evidence behind it. */
export type EvidenceScores = Record<string, number>;

export interface DiseaseAssociation {
  id: string;
  name: string;
  score: number;
  evidence: EvidenceScores;
}

export interface Rac1Snapshot extends Captured {
  target: {
    id: string; symbol: string; name: string; biotype: string;
    function: string; uniprot: string; uniprotFunction: string; subunit: string;
    length: number;
  };
  tractability: { label: string; modality: string; value: boolean }[];
  diseaseCount: number;
  diseases: DiseaseAssociation[];
  interactors: { partner: string; score: number; experimental: number; database: number }[];
  literature: { year: number; count: number }[];
}

// ── RAS, the opening chapter ─────────────────────────────────────────────────────────────────
export interface RasGene {
  id: string; symbol: string; name: string;
  /** Small-molecule tractability buckets Open Targets flags for the gene. */
  smallMolecule: string[];
  diseaseCount: number;
  diseases: DiseaseAssociation[];
  drugCount: number;
  drugs: { id: string; name: string; type: string; stage: string }[];
}

export interface RasSnapshot extends Captured {
  /** KRAS, HRAS, NRAS in that order. */
  genes: RasGene[];
  /** KRAS publications per year over the same window as the RAC1 dossier, so the two compare. */
  literature: { year: number; count: number }[];
}

/** Is this Open Targets disease name a malignancy? Coarse, by name, for colouring only. */
export const isCancer = (name: string): boolean =>
  /cancer|carcinoma|melanoma|leuk[ae]mia|tumou?r|lymphoma|neoplasm|sarcoma|glioma|myeloma|adenoma|blastoma/i.test(name);

// ── /science/bladder ─────────────────────────────────────────────────────────────────────────
export interface TargetAssociation {
  id: string;
  symbol: string;
  name: string;
  score: number;
  evidence: EvidenceScores;
  /** Small-molecule tractability buckets — what matters for an oral programme. */
  smallMolecule: string[];
}

export interface BladderSnapshot extends Captured {
  disease: { id: string; name: string; description: string };
  targetCount: number;
  targets: TargetAssociation[];
  drugCount: number;
  drugs: { id: string; name: string; type: string; stage: string }[];
}

/** Open Targets' evidence-type ids, in the order the pages stack them. */
export const EVIDENCE_TYPES = [
  'genetic_association', 'somatic_mutation', 'known_drug', 'clinical',
  'affected_pathway', 'literature', 'genetic_literature', 'rna_expression', 'animal_model',
] as const;

const EVIDENCE_LABELS: Record<string, string> = {
  genetic_association: 'Genetic association',
  somatic_mutation: 'Somatic mutation',
  known_drug: 'Known drug',
  clinical: 'Clinical',
  affected_pathway: 'Affected pathway',
  literature: 'Literature',
  genetic_literature: 'Genetic literature',
  rna_expression: 'RNA expression',
  animal_model: 'Animal model',
};

export const evidenceLabel = (id: string): string =>
  EVIDENCE_LABELS[id] ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Flatten `{ evidence: { genetic_association: 0.4, … } }` into rows a Vega stack can read. */
export function evidenceRows<T extends { evidence: EvidenceScores }>(
  items: T[],
  nameOf: (item: T) => string,
): { name: string; type: string; score: number }[] {
  const rows: { name: string; type: string; score: number }[] = [];
  for (const item of items) {
    for (const [type, score] of Object.entries(item.evidence)) {
      if (score > 0) rows.push({ name: nameOf(item), type: evidenceLabel(type), score });
    }
  }
  return rows;
}

/** `2026-09-18T10:53:29Z` → `18 Sep 2026`. */
export function capturedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.valueOf())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
