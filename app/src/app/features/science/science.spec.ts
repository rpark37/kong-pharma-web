/**
 * Guards the contract between `app/scripts/fetch-science.py` and the /science dossier.
 *
 * The snapshots are committed JSON fetched from public APIs, so the pages cannot type-check their
 * own inputs at runtime. These read the real committed files: if a re-run of the script changes a
 * shape — a renamed Open Targets field, a dropped column — the pages would render blank and only
 * this would say why.
 */
import bladderJson from '../../../../public/data/science/bladder.json';
import rac1Json from '../../../../public/data/science/rac1.json';
import rasJson from '../../../../public/data/science/ras.json';
import trialsJson from '../../../../public/data/science/trials.json';
import { associationSpec, literatureRaceSpec, phaseSpec, rasDiseaseSpec, stageSpec, statusSpec } from './science-specs';
import { capturedOn, evidenceRows, isCancer, type BladderSnapshot, type Rac1Snapshot, type RasSnapshot, type TrialsSnapshot } from './science.model';

// Imported rather than read from disk: the spec tsconfig exposes only vitest globals, and adding
// @types/node for two calls is not worth a dependency. Vite resolves the JSON at build time, so
// these are still the committed files.
const trials = trialsJson as unknown as TrialsSnapshot;
const rac1 = rac1Json as unknown as Rac1Snapshot;
const bladder = bladderJson as unknown as BladderSnapshot;
const ras = rasJson as unknown as RasSnapshot;

describe('science snapshots', () => {
  it('every snapshot records when it was captured', () => {
    for (const [name, snap] of [['trials', trials], ['rac1', rac1], ['bladder', bladder], ['ras', ras]] as const) {
      expect(snap.captured, name).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(new Date(snap.captured).valueOf(), name).not.toBeNaN();
    }
  });

  it('renders a capture date a human can read', () => {
    // Matched by shape, not spelling: Intl renders September as "Sep" or "Sept" depending on the
    // ICU build, and pinning one makes the suite fail on a different Node.
    expect(capturedOn('2026-09-18T10:53:29Z')).toMatch(/^18 Sept? 2026$/);
    // Anything unparseable is shown as-is rather than as "Invalid Date".
    expect(capturedOn('not a date')).toBe('not a date');
  });
});

describe('trials snapshot', () => {
  it('covers all three programmes with non-zero totals', () => {
    expect(trials.conditions).toHaveLength(3);
    for (const c of trials.conditions) {
      expect(c.total, c.label).toBeGreaterThan(0);
      expect(c.programme, c.label).toMatch(/^(CR-067|K-119|XTL-152)$/);
    }
  });

  it('keeps every phase bucket within the indication total', () => {
    // Buckets overlap rather than partition: ClinicalTrials.gov counts a Phase 1/Phase 2 study
    // under both, so the buckets can sum past the total. Each one alone must still fit inside it.
    for (const c of trials.conditions) {
      expect(c.phases.length, c.label).toBeGreaterThan(0);
      for (const p of c.phases) {
        expect(p.count, `${c.label} ${p.phase}`).toBeGreaterThanOrEqual(0);
        expect(p.count, `${c.label} ${p.phase}`).toBeLessThanOrEqual(c.total);
      }
      expect(c.phases.reduce((n, p) => n + p.count, 0), c.label).toBeGreaterThan(0);
    }
  });

  it('keeps every status bucket within the indication total', () => {
    // Status, unlike phase, is single-valued, so these really are a partition.
    for (const c of trials.conditions) {
      expect(c.statuses.reduce((n, s) => n + s.count, 0), c.label).toBeLessThanOrEqual(c.total);
    }
  });

  it('gives every recent trial an NCT id the table can link to', () => {
    expect(trials.recent.length).toBeGreaterThan(0);
    for (const t of trials.recent) expect(t.nctId, t.title).toMatch(/^NCT\d{8}$/);
  });

  it('builds phase and status specs with rows', () => {
    const phase = phaseSpec(trials.conditions.flatMap((c) => c.phases.map((p) => ({ indication: c.label, ...p }))));
    expect((phase['data'] as { values: unknown[] }).values.length).toBeGreaterThan(0);
    const status = statusSpec(trials.conditions.flatMap((c) => c.statuses.map((s) => ({ indication: c.label, ...s }))));
    expect((status['data'] as { values: unknown[] }).values.length).toBeGreaterThan(0);
  });
});

describe('RAC1 snapshot', () => {
  it('is the RAC1 target with its UniProt entry', () => {
    expect(rac1.target.symbol).toBe('RAC1');
    expect(rac1.target.id).toBe('ENSG00000136238');
    expect(rac1.target.uniprot).toBe('P63000');
    expect(rac1.target.length).toBeGreaterThan(0);
    expect(rac1.target.uniprotFunction.length).toBeGreaterThan(40);
  });

  it('ranks disease associations by descending score', () => {
    expect(rac1.diseases.length).toBeGreaterThan(0);
    expect(rac1.diseaseCount).toBeGreaterThanOrEqual(rac1.diseases.length);
    const scores = rac1.diseases.map((d) => d.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const d of rac1.diseases) expect(d.score, d.name).toBeGreaterThan(0);
  });

  it('carries interactors and a 20-year publication series', () => {
    expect(rac1.interactors.length).toBeGreaterThan(0);
    expect(rac1.literature).toHaveLength(20);
    const years = rac1.literature.map((l) => l.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('flattens evidence into one row per contributing type', () => {
    const rows = evidenceRows(rac1.diseases, (d) => d.name);
    expect(rows.length).toBeGreaterThan(rac1.diseases.length);
    for (const r of rows) expect(r.score, r.name).toBeGreaterThan(0);
    // Labels are humanised, never raw ids.
    expect(rows.some((r) => r.type.includes('_'))).toBe(false);
  });

  it('builds its specs', () => {
    const spec = associationSpec(evidenceRows(rac1.diseases, (d) => d.name), rac1.diseases.map((d) => d.name), 'Score');
    expect((spec['data'] as { values: unknown[] }).values.length).toBeGreaterThan(0);
  });
});

describe('bladder snapshot', () => {
  it('is urinary bladder carcinoma with ranked targets', () => {
    expect(bladder.disease.id).toBe('MONDO_0004986');
    expect(bladder.targets.length).toBeGreaterThan(0);
    expect(bladder.targetCount).toBeGreaterThanOrEqual(bladder.targets.length);
    const scores = bladder.targets.map((t) => t.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('gives every target a symbol and every drug a stage', () => {
    for (const t of bladder.targets) expect(t.symbol, t.id).toMatch(/\S/);
    for (const d of bladder.drugs) expect(d.stage, d.name).toMatch(/\S/);
  });

  it('lists each drug once, having collapsed the per-indication rows', () => {
    const ids = bladder.drugs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds a stage spec whose counts sum to the drugs listed', () => {
    const counts = new Map<string, number>();
    for (const d of bladder.drugs) counts.set(d.stage, (counts.get(d.stage) ?? 0) + 1);
    const rows = [...counts].map(([stage, count]) => ({ stage, count }));
    const spec = stageSpec(rows, []);
    const values = (spec['data'] as { values: { count: number }[] }).values;
    expect(values.reduce((n, v) => n + v.count, 0)).toBe(bladder.drugs.length);
  });
});

describe('RAS snapshot', () => {
  it('carries KRAS, HRAS and NRAS in that order, each with ranked diseases', () => {
    expect(ras.genes.map((g) => g.symbol)).toEqual(['KRAS', 'HRAS', 'NRAS']);
    for (const g of ras.genes) {
      expect(g.diseaseCount, g.symbol).toBeGreaterThanOrEqual(g.diseases.length);
      const scores = g.diseases.map((d) => d.score);
      expect(scores, g.symbol).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('ties HRAS to the bladder indication the dossier ends on', () => {
    const hras = ras.genes.find((g) => g.symbol === 'HRAS')!;
    expect(hras.diseases.some((d) => /bladder/i.test(d.name))).toBe(true);
    expect(bladder.targets.some((t) => t.symbol === 'HRAS')).toBe(true);
  });

  it('shares the RAC1 literature window so the two series compare', () => {
    expect(ras.literature.map((l) => l.year)).toEqual(rac1.literature.map((l) => l.year));
  });

  it('tells malignancies from the RASopathies by name', () => {
    expect(isCancer('non-small cell lung carcinoma')).toBe(true);
    expect(isCancer('Noonan syndrome')).toBe(false);
  });

  it('builds the chapter I figures', () => {
    const facets = rasDiseaseSpec(ras.genes);
    expect((facets['data'] as { values: unknown[] }).values.length).toBe(ras.genes.length * 8);
    const race = literatureRaceSpec([...ras.literature.map((l) => ({ gene: 'KRAS', ...l })), ...rac1.literature.map((l) => ({ gene: 'RAC1', ...l }))]);
    expect((race['data'] as { values: unknown[] }).values.length).toBe(40);
  });
});
