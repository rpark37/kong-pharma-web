#!/usr/bin/env python3
"""
Fetch the snapshots behind the three /science pages.

The agent skills that know these APIs run in an agent, not in a browser, and the app deploys to
GitHub Pages with no server of its own. So the data is pulled here, once, and committed as static
JSON under public/data/science/. Re-run to refresh; every page reads the committed file.

    python3 app/scripts/fetch-science.py

Stdlib only, no API keys. Every source is public:
  - Open Targets Platform GraphQL   https://api.platform.opentargets.org/api/v4/graphql
  - ClinicalTrials.gov API v2       https://clinicaltrials.gov/api/v2
  - UniProt REST                    https://rest.uniprot.org
  - STRING                          https://string-db.org/api
  - Europe PMC                      https://www.ebi.ac.uk/europepmc/webservices/rest
"""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'data' / 'science'
UA = {'User-Agent': 'kong-atlas-labs/1.0 (science snapshot)'}

# XTL-152 targets Rac1; K-119 is a bladder-cancer programme; CR-067 treats ED.
RAC1 = 'ENSG00000136238'
# The story opens on RAS: the oncogene family whose tumours scavenge nutrients by macropinocytosis.
RAS = [('KRAS', 'ENSG00000133703'), ('HRAS', 'ENSG00000174775'), ('NRAS', 'ENSG00000213281')]
BLADDER = 'MONDO_0004986'  # urinary bladder carcinoma
CONDITIONS = [
    {'key': 'bladder', 'label': 'Bladder cancer', 'cond': 'bladder cancer', 'programme': 'K-119'},
    {'key': 'ed', 'label': 'Erectile dysfunction', 'cond': 'erectile dysfunction', 'programme': 'CR-067'},
    {'key': 'solid', 'label': 'Solid tumour', 'cond': 'solid tumor', 'programme': 'XTL-152'},
]
PHASES = [('0', 'Early Phase 1'), ('1', 'Phase 1'), ('2', 'Phase 2'), ('3', 'Phase 3'), ('4', 'Phase 4')]
STATUSES = [
    ('RECRUITING', 'Recruiting'), ('NOT_YET_RECRUITING', 'Not yet recruiting'),
    ('ACTIVE_NOT_RECRUITING', 'Active, not recruiting'), ('COMPLETED', 'Completed'),
    ('TERMINATED', 'Terminated'), ('WITHDRAWN', 'Withdrawn'),
]


def _get(url: str, tries: int = 3):
    """These public endpoints fail intermittently; a bare request loses a whole run to one blip."""
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
                return json.load(r)
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            if attempt == tries - 1:
                raise
            print(f'    retry {attempt + 1}/{tries - 1} after {type(e).__name__}', file=sys.stderr)
            time.sleep(1.5 * (attempt + 1))


def gql(query: str, tries: int = 3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(
                'https://api.platform.opentargets.org/api/v4/graphql',
                data=json.dumps({'query': query}).encode(),
                headers={**UA, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=45) as r:
                body = json.load(r)
            if 'errors' in body:
                raise RuntimeError(body['errors'])
            return body['data']
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
            if attempt == tries - 1:
                raise
            print(f'    retry {attempt + 1}/{tries - 1} after {type(e).__name__}', file=sys.stderr)
            time.sleep(1.5 * (attempt + 1))


def ct_count(cond: str, **extra) -> int:
    """A count-only query: pageSize=1 so ClinicalTrials.gov totals without shipping the studies."""
    params = {'countTotal': 'true', 'pageSize': 1, 'query.cond': cond, **extra}
    return _get('https://clinicaltrials.gov/api/v2/studies?' + urllib.parse.urlencode(params))['totalCount']


def fetch_trials() -> dict:
    conditions = []
    for c in CONDITIONS:
        print(f'  {c["label"]}…')
        total = ct_count(c['cond'])
        phases = [{'phase': lbl, 'count': ct_count(c['cond'], aggFilters=f'phase:{p}')} for p, lbl in PHASES]
        statuses = [{'status': lbl, 'count': ct_count(c['cond'], **{'filter.overallStatus': s})} for s, lbl in STATUSES]
        conditions.append({**c, 'total': total, 'phases': phases, 'statuses': statuses})

    # A handful of named recruiting industry trials, so the page shows studies and not only totals.
    recent = []
    for c in CONDITIONS:
        params = {
            'pageSize': 8, 'query.cond': c['cond'], 'filter.overallStatus': 'RECRUITING',
            'sort': 'StartDate:desc',
            'fields': 'NCTId|BriefTitle|Phase|OverallStatus|LeadSponsorName|EnrollmentCount|StartDate',
        }
        data = _get('https://clinicaltrials.gov/api/v2/studies?' + urllib.parse.urlencode(params))
        for s in data.get('studies', []):
            p = s.get('protocolSection', {})
            ident, design = p.get('identificationModule', {}), p.get('designModule', {})
            recent.append({
                'condition': c['label'],
                'nctId': ident.get('nctId'),
                'title': ident.get('briefTitle'),
                'phase': ', '.join(design.get('phases', [])) or 'N/A',
                'status': p.get('statusModule', {}).get('overallStatus'),
                'sponsor': p.get('sponsorCollaboratorsModule', {}).get('leadSponsor', {}).get('name'),
                'enrollment': (design.get('enrollmentInfo') or {}).get('count'),
                'start': (p.get('statusModule', {}).get('startDateStruct') or {}).get('date'),
            })
    return {'conditions': conditions, 'recent': recent}


def fetch_rac1() -> dict:
    print('  Open Targets…')
    t = gql(f'''{{
      target(ensemblId:"{RAC1}") {{
        id approvedSymbol approvedName biotype functionDescriptions
        proteinIds {{ id source }}
        tractability {{ label modality value }}
        associatedDiseases(page:{{index:0,size:25}}) {{
          count
          rows {{ score disease {{ id name }} datatypeScores {{ id score }} }}
        }}
      }}
    }}''')['target']

    print('  UniProt…')
    uni = _get('https://rest.uniprot.org/uniprotkb/P63000.json')
    function = next((c['texts'][0]['value'] for c in uni.get('comments', [])
                     if c.get('commentType') == 'FUNCTION' and c.get('texts')), '')
    subunit = next((c['texts'][0]['value'] for c in uni.get('comments', [])
                    if c.get('commentType') == 'SUBUNIT' and c.get('texts')), '')

    print('  STRING…')
    partners = _get('https://string-db.org/api/json/interaction_partners?'
                    + urllib.parse.urlencode({'identifiers': 'RAC1', 'species': 9606, 'limit': 20}))

    print('  Europe PMC…')
    years = []
    now = datetime.now(timezone.utc).year
    for y in range(now - 19, now + 1):
        q = urllib.parse.quote(f'(RAC1) AND (FIRST_PDATE:[{y}-01-01 TO {y}-12-31])')
        hits = _get(f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&pageSize=1')
        years.append({'year': y, 'count': hits['hitCount']})

    return {
        'target': {
            'id': t['id'], 'symbol': t['approvedSymbol'], 'name': t['approvedName'],
            'biotype': t['biotype'],
            'function': (t.get('functionDescriptions') or [''])[0],
            'uniprot': 'P63000',
            'uniprotFunction': function,
            'subunit': subunit,
            'length': uni.get('sequence', {}).get('length'),
        },
        'tractability': [x for x in (t.get('tractability') or []) if x.get('value')],
        'diseaseCount': t['associatedDiseases']['count'],
        'diseases': [{
            'id': r['disease']['id'], 'name': r['disease']['name'], 'score': r['score'],
            'evidence': {d['id']: d['score'] for d in r['datatypeScores']},
        } for r in t['associatedDiseases']['rows']],
        'interactors': [{
            'partner': p['preferredName_B'], 'score': p['score'],
            'experimental': p.get('escore', 0), 'database': p.get('dscore', 0),
        } for p in partners],
        'literature': years,
    }


STAGE_ORDER = ['PRECLINICAL', 'PHASE_1', 'PHASE_1_2', 'PHASE_2', 'PHASE_2_3', 'PHASE_3', 'PHASE_4', 'APPROVED']


def _stage_label(stage: str) -> str:
    """PHASE_2_3 is one straddling stage, not two: render it "Phase 2/3", not "Phase 2 3"."""
    if not stage:
        return 'Unknown'
    parts = stage.split('_')
    if parts[0] == 'PHASE' and len(parts) > 2:
        return 'Phase ' + '/'.join(parts[1:])
    return stage.replace('_', ' ').title()


def _collapse_drugs(rows: list) -> list:
    """Open Targets returns a row per drug-indication pair. Keep each drug once, at its best stage."""
    best: dict = {}
    for r in rows:
        drug, stage = r['drug'], r.get('maxClinicalStage') or ''
        prev = best.get(drug['id'])
        rank = STAGE_ORDER.index(stage) if stage in STAGE_ORDER else -1
        if prev is None or rank > prev['rank']:
            best[drug['id']] = {
                'id': drug['id'], 'name': drug['name'].title(), 'type': drug['drugType'],
                'stage': _stage_label(stage), 'rank': rank,
            }
    out = sorted(best.values(), key=lambda d: -d['rank'])
    for d in out:
        d.pop('rank')
    return out


def fetch_bladder() -> dict:
    print('  Open Targets…')
    d = gql(f'''{{
      disease(efoId:"{BLADDER}") {{
        id name description
        associatedTargets(page:{{index:0,size:25}}) {{
          count
          rows {{
            score
            target {{ id approvedSymbol approvedName tractability {{ label modality value }} }}
            datatypeScores {{ id score }}
          }}
        }}
        drugAndClinicalCandidates {{
          count
          rows {{ id maxClinicalStage drug {{ id name drugType }} }}
        }}
      }}
    }}''')['disease']

    def tractable(t):
        """Small-molecule tractability is what matters for an oral programme like K-119."""
        return sorted({x['label'] for x in (t.get('tractability') or [])
                       if x.get('value') and x.get('modality') == 'SM'})

    return {
        'disease': {'id': d['id'], 'name': d['name'], 'description': (d.get('description') or '')[:400]},
        'targetCount': d['associatedTargets']['count'],
        'targets': [{
            'id': r['target']['id'], 'symbol': r['target']['approvedSymbol'],
            'name': r['target']['approvedName'], 'score': r['score'],
            'evidence': {x['id']: x['score'] for x in r['datatypeScores']},
            'smallMolecule': tractable(r['target']),
        } for r in d['associatedTargets']['rows']],
        # One row per drug-indication pair, so the same drug recurs; collapse to its furthest stage.
        'drugCount': d['drugAndClinicalCandidates']['count'],
        'drugs': _collapse_drugs(d['drugAndClinicalCandidates']['rows']),
    }


def fetch_ras() -> dict:
    genes = []
    for symbol, ensg in RAS:
        print(f'  Open Targets {symbol}…')
        t = gql(f'''{{
          target(ensemblId:"{ensg}") {{
            id approvedSymbol approvedName
            tractability {{ label modality value }}
            associatedDiseases(page:{{index:0,size:12}}) {{
              count
              rows {{ score disease {{ id name }} datatypeScores {{ id score }} }}
            }}
            drugAndClinicalCandidates {{
              count
              rows {{ id maxClinicalStage drug {{ id name drugType }} }}
            }}
          }}
        }}''')['target']
        genes.append({
            'id': t['id'], 'symbol': t['approvedSymbol'], 'name': t['approvedName'],
            'smallMolecule': sorted({x['label'] for x in (t.get('tractability') or [])
                                     if x.get('value') and x.get('modality') == 'SM'}),
            'diseaseCount': t['associatedDiseases']['count'],
            'diseases': [{
                'id': r['disease']['id'], 'name': r['disease']['name'], 'score': r['score'],
                'evidence': {d['id']: d['score'] for d in r['datatypeScores']},
            } for r in t['associatedDiseases']['rows']],
            'drugCount': t['drugAndClinicalCandidates']['count'],
            'drugs': _collapse_drugs(t['drugAndClinicalCandidates']['rows'])[:12],
        })

    # KRAS against RAC1, the same 20-year window the RAC1 dossier draws, so the two series compare.
    print('  Europe PMC…')
    years = []
    now = datetime.now(timezone.utc).year
    for y in range(now - 19, now + 1):
        q = urllib.parse.quote(f'(KRAS) AND (FIRST_PDATE:[{y}-01-01 TO {y}-12-31])')
        url = f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&pageSize=1'
        hits = _get(url)
        if 'hitCount' not in hits:  # Europe PMC answers a burst with an error document, not a 429
            time.sleep(2)
            hits = _get(url)
        years.append({'year': y, 'count': hits['hitCount']})
        time.sleep(0.3)

    return {'genes': genes, 'literature': years}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    captured = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    jobs = [('trials', fetch_trials), ('rac1', fetch_rac1), ('bladder', fetch_bladder), ('ras', fetch_ras)]
    # `--only ras` refreshes one snapshot and leaves the others' capture dates alone.
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    if only:
        jobs = [j for j in jobs if j[0] == only]
    failed = []
    for name, fn in jobs:
        print(f'{name}:')
        try:
            payload = {'captured': captured, **fn()}
        except Exception as e:  # noqa: BLE001 — one dead endpoint should not lose the other two
            print(f'  FAILED: {type(e).__name__}: {e}', file=sys.stderr)
            failed.append(name)
            continue
        path = OUT / f'{name}.json'
        path.write_text(json.dumps(payload, indent=2) + '\n')
        print(f'  wrote {path.relative_to(OUT.parent.parent.parent)} ({path.stat().st_size:,} bytes)')
    if failed:
        print(f'\nFAILED: {", ".join(failed)} — rerun; the others are written.', file=sys.stderr)
        return 1
    print(f'\n{len(jobs)} snapshot(s) captured at {captured}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
