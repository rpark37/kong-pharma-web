#!/usr/bin/env python3
"""
Fetch the AlphaFold structure behind each gene story and reduce it to a Cα trace.

    python3 app/scripts/fetch-structures.py

One JSON per gene under public/data/science/structures/: the alpha-carbon of every residue with
its pLDDT, centred on the origin, one decimal. A full PDB is 0.1–2 MB; the trace is a few tens of
KB and is all the page draws (beads on a string, path-traced by MorphCharts). Stdlib only.

Sources: the AlphaFold Protein Structure Database (EMBL-EBI / DeepMind, CC BY 4.0) via its
prediction API, and UniProt for the accession-to-gene check.
"""
import json
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data' / 'science' / 'structures'
UA = {'User-Agent': 'kong-atlas-labs/1.0 (structure snapshot)'}

# Symbol → UniProt accession, in story order. The AlphaFold entry's own gene name is checked
# against the symbol, so a wrong accession fails loudly rather than drawing the wrong protein.
GENES = [
    ('KRAS', 'P01116'), ('HRAS', 'P01112'), ('NRAS', 'P01111'), ('RAC1', 'P63000'),
    ('PAK1', 'Q13153'), ('CDC42', 'P60953'), ('PIK3CA', 'P42336'), ('PTEN', 'P60484'),
    ('SLC9A1', 'P19634'), ('ARF6', 'P62330'), ('RAB5A', 'P20339'), ('RAB7A', 'P51149'),
    ('MTOR', 'P42345'), ('HIF1A', 'Q16665'),
]


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read()


def trace(pdb: str) -> list:
    """Cα atoms only: [x, y, z, pLDDT] per residue. AlphaFold writes pLDDT in the B-factor column."""
    out = []
    for line in pdb.splitlines():
        if line.startswith('ATOM') and line[12:16].strip() == 'CA':
            out.append([float(line[30:38]), float(line[38:46]), float(line[46:54]), float(line[60:66])])
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    captured = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    failed = []
    for symbol, acc in GENES:
        print(f'{symbol} ({acc})…')
        try:
            entry = json.loads(get(f'https://alphafold.ebi.ac.uk/api/prediction/{acc}'))[0]
            if entry.get('gene') != symbol:
                raise RuntimeError(f'AlphaFold names {acc} as {entry.get("gene")!r}, not {symbol}')
            residues = trace(get(entry['pdbUrl']).decode())
            if not residues:
                raise RuntimeError('no Cα atoms parsed')
            n = len(residues)
            cx, cy, cz = (sum(r[i] for r in residues) / n for i in range(3))
            payload = {
                'captured': captured, 'symbol': symbol, 'uniprot': acc,
                'model': entry['entryId'], 'version': entry.get('latestVersion'), 'modelDate': entry.get('modelCreatedDate'),
                'length': n, 'meanPlddt': entry.get('globalMetricValue'),
                'residues': [[round(r[0] - cx, 1), round(r[1] - cy, 1), round(r[2] - cz, 1), round(r[3], 1)] for r in residues],
            }
            path = OUT / f'{symbol}.json'
            path.write_text(json.dumps(payload, separators=(',', ':')) + '\n')
            print(f'  {n} residues, mean pLDDT {payload["meanPlddt"]}, {path.stat().st_size:,} bytes')
        except Exception as e:  # noqa: BLE001 — one missing model should not lose the others
            print(f'  FAILED: {type(e).__name__}: {e}', file=sys.stderr)
            failed.append(symbol)
    if failed:
        print(f'\nFAILED: {", ".join(failed)}', file=sys.stderr)
        return 1
    print(f'\n{len(GENES)} structures captured at {captured}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
