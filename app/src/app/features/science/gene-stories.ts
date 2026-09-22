/**
 * One story per gene, in the order the route runs: the three RAS genes, the switch, then the
 * machinery from ruffle to sensor. The prose is hand-written from the literature; every number a
 * story quotes comes from the snapshot the page loads beside it, never from here.
 */
import type { MachineryStage } from './science.model';

export type Station = 'ras' | 'rac1' | 'ruffle' | 'cup' | 'early' | 'late' | 'lysosome' | 'sensing';

export interface GeneStory {
  symbol: string;
  /** Which snapshot carries its numbers. */
  source: 'ras' | 'rac1' | 'machinery';
  station: Station;
  /** The kicker under the symbol. */
  role: string;
  /** One sentence for the lead. */
  hook: string;
  /** What it is and does — two paragraphs. */
  what: string[];
  /** Its part in the drinking — one or two paragraphs. */
  route: string[];
  /** What that means for Kong's programmes — one paragraph. */
  kong: string;
}

export const STATION_LABEL: Record<Station, string> = {
  ras: 'The oncogene', rac1: 'The switch', ruffle: 'The ruffle', cup: 'Closing the cup', early: 'Early traffic', late: 'Late traffic', lysosome: 'The lysosome', sensing: 'Sensing',
};

export const STAGE_STATION: Record<MachineryStage, Station> = { ruffle: 'ruffle', closure: 'cup', traffic: 'early', sensing: 'sensing' };

/** The route as stations, for the strip each story draws with its own station lit. */
export const STATIONS: { id: Station; label: string; genes: string[] }[] = [
  { id: 'ras', label: 'RAS', genes: ['KRAS', 'HRAS', 'NRAS'] },
  { id: 'rac1', label: 'RAC1', genes: ['RAC1'] },
  { id: 'ruffle', label: 'RUFFLE', genes: ['PAK1', 'CDC42', 'PIK3CA', 'PTEN'] },
  { id: 'cup', label: 'CUP', genes: ['SLC9A1', 'ARF6'] },
  { id: 'early', label: 'EARLY', genes: ['RAB5A'] },
  { id: 'late', label: 'LATE', genes: ['RAB7A'] },
  { id: 'lysosome', label: 'LYSOSOME', genes: [] },
];

export const GENE_STORIES: GeneStory[] = [
  {
    symbol: 'KRAS', source: 'ras', station: 'ras', role: 'The oncogene',
    hook: 'The most-mutated oncogene in human cancer, and the one that made the family famous.',
    what: [
      'KRAS is one of three RAS genes, and the one solid tumours favour: pancreatic, colorectal and lung adenocarcinomas carry it mutated more often than any other oncogene. The protein is a small GTPase anchored to the inner face of the plasma membrane. Bound to GTP it is on, and it hands growth signalling to RAF, PI3K and a dozen other effectors; hydrolyse the GTP and it is off. The mutations that matter — at codons 12, 13 and 61 — cripple that hydrolysis, so the switch stays on.',
      'For forty years the protein resisted drugs. Its affinity for GTP is picomolar, so competing at the nucleotide site is hopeless, and its surface offered no pocket. That changed when a covalent pocket was found beneath the switch-II loop of one mutant, G12C: the first inhibitors bind the cysteine the mutation installs, and hold the protein off. The snapshot beside this page counts how many candidates have followed, and how far they have got.',
    ],
    route: [
      'A KRAS-mutant cell is a hungry one. With the switch jammed on, it can grow faster than its blood supply, and it makes up the shortfall by drinking: membrane ruffles fold into cups and close into macropinosomes full of extracellular protein, which the lysosome breaks down into amino acids. This was shown first in pancreatic cancer, where RAS-mutant cells were found to live on scavenged albumin when glutamine ran out. The ruffle itself is thrown by RAC1, downstream, which is where this dossier turns next.',
    ],
    kong: 'Kong does not go after KRAS. XTL-152 acts at RAC1, one switch downstream, so it does not depend on which RAS mutation a tumour carries — G12C, G12D or none of the covalent-pocket kind.',
  },
  {
    symbol: 'HRAS', source: 'ras', station: 'ras', role: 'The oncogene',
    hook: 'The first human oncogene cloned, and the RAS gene bladder cancer favours.',
    what: [
      'HRAS was the first human oncogene anyone isolated: in 1982 the transforming DNA of a bladder-carcinoma cell line turned out to be HRAS with a single base change, glycine 12 to valine. The protein works exactly as KRAS does — the same GTP switch, the same effectors — and its hotspot mutations jam it on the same way. It differs in where it sits on the membrane and in which tissues lean on it.',
      'Germline HRAS variants cause Costello syndrome, which is why the snapshot\'s top association is developmental rather than malignant. The same switch, inherited rather than acquired, shapes growth in every cell instead of one clone.',
    ],
    route: [
      'In urinary bladder carcinoma HRAS is one of the two founding lesions. Papillary, non-invasive tumours tend to carry either an activating FGFR3 mutation or a RAS one — the two are famously exclusive — and either way the cell ends up with a MAPK and PI3K signal it cannot turn off, and the appetite that comes with it. That appetite is met the same way as in a KRAS tumour: by macropinocytosis, through RAC1.',
    ],
    kong: 'This is K-119\'s indication. An oral small molecule that shuts the drinking would sit in the gap the clinic table on the dossier shows: a field of antibodies and checkpoint inhibitors, with few small molecules in it.',
  },
  {
    symbol: 'NRAS', source: 'ras', station: 'ras', role: 'The oncogene',
    hook: 'The RAS of melanoma and of the blood.',
    what: [
      'NRAS is the third RAS gene, named for the neuroblastoma line it was found in. It carries the same switch as its siblings and is mutated in the same places, most often at codon 61. Its tumours are different ones: about a fifth of cutaneous melanomas, and a run of blood cancers — acute myeloid leukaemia among them — which is what the snapshot\'s associations show.',
      'Like HRAS it has a germline face. Inherited NRAS variants cause a form of Noonan syndrome, and the naevus syndromes in the list are mosaic: an NRAS mutation acquired early in development, present in a patch of skin rather than a tumour.',
    ],
    route: [
      'Melanoma is also where RAC1 carries its own hotspot mutation, P29S, in sun-exposed skin. The two genes meet in the same pathway: NRAS above, RAC1 below, the ruffle and the macropinosome at the end of it. An NRAS-driven cell drinks for the same reason a KRAS-driven one does, and the drinking runs through the same switch.',
    ],
    kong: 'The third route into the same hungry state, and the third reason to act at RAC1 rather than above it.',
  },
  {
    symbol: 'RAC1', source: 'rac1', station: 'rac1', role: 'The switch',
    hook: 'The switch a small molecule can reach.',
    what: [
      'RAC1 is a Rho-family GTPase, a cousin of RAS with the same on/off mechanism and a different job: it organises actin. Loaded with GTP by an exchange factor, it binds effectors — PAK kinases, the WAVE complex — that push a sheet of actin against the membrane and throw it out as a ruffle or a lamellipodium. Cells crawl with it, engulf with it, and, when they are hungry, drink with it.',
      'It has a hotspot of its own. RAC1 P29S, found in sun-exposed melanoma, is a fast-cycling mutant that loads GTP by itself, which is why melanoma and its variants stack up in the snapshot\'s association list beside the germline neurodevelopmental entries. The rest of the list is the biology of a protein every cell uses.',
    ],
    route: [
      'This is the node where the RAS signal becomes a ruffle. RAS activates PI3K; PI3K makes PIP3; PIP3 recruits the exchange factors — PREX1 and VAV1 among the partners the snapshot names — that load RAC1, and TIAM1 binds RAS directly. Active RAC1 hands off to PAK1 and the actin machinery, and the membrane goes up. Cut the signal here and the ruffle never forms, whatever RAS is doing above.',
      'Unlike RAS, RAC1 offers a ligand-bound structure and a high-quality pocket: the tractability flags in the ledger are Open Targets saying so. That is the difference between a target and a hope.',
    ],
    kong: 'XTL-152 is the programme built on this switch: small molecules screened by AI against RAC1 and read out in the macropinocytosis assay, so that a tumour keeps its mutation and loses its meal.',
  },
  {
    symbol: 'PAK1', source: 'machinery', station: 'ruffle', role: 'The ruffle',
    hook: 'The kinase that turns an active RAC1 into a moving membrane.',
    what: [
      'PAK1 is a serine/threonine kinase and RAC1\'s best-known effector. Inactive, it folds on itself; when GTP-bound RAC1 or CDC42 binds its N-terminus the fold opens, the kinase autophosphorylates, and it starts working on the cytoskeleton — LIM kinase, which stops cofilin from cutting actin filaments, and myosin regulators that set the tension in the cortex. The upshot is a ruffle that grows and keeps growing.',
      'The snapshot\'s associations are neurodevelopmental: germline PAK1 variants cause a macrocephaly-and-seizures syndrome, the kinase left on in a developing brain. Its cancer biology is amplification and overexpression rather than mutation, which the association score does not weigh heavily.',
    ],
    route: [
      'PAK1 is the first thing RAC1 touches on the way to a macropinosome. Inhibit it and the ruffle flattens even with RAC1 active — which is why PAK inhibitors are a standard tool for switching macropinocytosis off in the dish, and why the gene appears in a good share of the papers the ledger counts.',
    ],
    kong: 'A checkpoint one step below XTL-152\'s: the readout that shows a RAC1 inhibitor working is the same ruffle-and-cup shape assay that a PAK1 inhibitor flattens.',
  },
  {
    symbol: 'CDC42', source: 'machinery', station: 'ruffle', role: 'The ruffle',
    hook: "RAC1's sibling, in charge of the cup's edges.",
    what: [
      'CDC42 is the other Rho GTPase of the ruffle. Where RAC1 raises a broad sheet, CDC42 makes filopodia — thin spikes — and sets the polarity that tells a cell which way is forward. The two share exchange factors and effectors, PAK1 included, and are loaded and unloaded together at the leading edge.',
      'Its germline disease in the snapshot is Takenouchi-Kosaki syndrome, a rare disorder of platelets, lymphatics and development — the GTPase misbehaving everywhere at once. In tumours it is more often overexpressed than mutated.',
    ],
    route: [
      'A macropinocytic cup needs a rim as well as a sheet, and CDC42 is what shapes it. Dominant-negative CDC42 blocks macropinocytosis in the classic experiments alongside dominant-negative RAC1, and the pair are the reason the standard inhibitor, amiloride, works: the drop in submembranous pH it causes stops both from signalling.',
    ],
    kong: 'Part of the switch\'s immediate neighbourhood. A RAC1 inhibitor is measured against exactly the ruffle these two GTPases build together.',
  },
  {
    symbol: 'PIK3CA', source: 'machinery', station: 'ruffle', role: 'The ruffle',
    hook: 'The enzyme that writes the lipid signal the cup closes on.',
    what: [
      'PIK3CA encodes p110α, the catalytic subunit of class I PI3K. RAS binds it directly; so do receptor tyrosine kinases through its regulatory partner. Once on, it converts PIP2 in the membrane into PIP3, the lipid that recruits AKT and the exchange factors that load RAC1. Its hotspot mutations, E545K and H1047R, are among the commonest in breast and other carcinomas.',
      'It is well drugged. The snapshot lists candidates reaching approval — PI3K inhibitors are in the clinic for breast cancer and lymphoma — and the germline overgrowth spectrum at the top of the association list (megalencephaly, CLOVES) is the same enzyme left on during development.',
    ],
    route: [
      'PIP3 has two jobs in macropinocytosis. At the ruffle it brings PREX1 and VAV1 to RAC1 and keeps the sheet rising. At the cup it accumulates in a ring around the base, and that ring is required for the cup to pinch closed into a vesicle — inhibit PI3K and cells ruffle but never swallow. That is why PIK3CA names more macropinocytosis papers than any other gene in the ledger.',
    ],
    kong: 'Upstream of RAC1 and shared with a great deal else, which is the argument for acting at the switch instead: PI3K inhibition costs the whole cell its lipid signal, RAC1 inhibition costs it the ruffle.',
  },
  {
    symbol: 'PTEN', source: 'machinery', station: 'ruffle', role: 'The ruffle',
    hook: 'The eraser. Lose it and the drinking never stops.',
    what: [
      'PTEN is the phosphatase that undoes PIK3CA: it strips the 3-phosphate from PIP3 and returns the membrane to PIP2. It is a tumour suppressor, lost by deletion or mutation in prostate, endometrial, brain and many other cancers, and inherited PTEN variants cause Cowden syndrome — the hamartomas and cancer risk at the top of the snapshot\'s list.',
      'There is nothing to drug in the usual sense; a lost gene cannot be inhibited. What its loss does is make the cell dependent on everything PIP3 drives, which is where the leverage is.',
    ],
    route: [
      'PTEN-null cells are among the heaviest drinkers known. With PIP3 unopposed the ruffle signal stays on, and prostate tumours lacking PTEN were shown to feed themselves by macropinocytosis of extracellular protein and even of dead-cell debris — nutrient scavenging as a consequence of a lost brake rather than a jammed accelerator.',
    ],
    kong: 'A second population, beyond RAS-mutant tumours, whose appetite runs through RAC1: the same switch, reached from the other side.',
  },
  {
    symbol: 'SLC9A1', source: 'machinery', station: 'cup', role: 'Closing the cup',
    hook: 'The proton pump behind the oldest macropinocytosis inhibitor.',
    what: [
      'SLC9A1 encodes NHE1, the ubiquitous sodium–proton exchanger of the plasma membrane. It swaps one sodium in for one proton out, sets the cell\'s resting pH, and swells the cell when it needs to move. It is not an oncogene; its rare germline disease, Lichtenstein-Knorr syndrome, is an ataxia and deafness of the ion balance.',
      'It matters here because of what blocks it. Amiloride and its potent analogue EIPA inhibit NHE1, and for decades they have been the standard way to switch macropinocytosis off in an experiment — which is why the gene\'s modest paper count in the ledger undersells its importance.',
    ],
    route: [
      'The mechanism is local pH. NHE1 keeps the layer of cytoplasm just under the ruffle alkaline enough for RAC1 and CDC42 to signal; block it and the layer acidifies, the GTPases go quiet, and the cup fails to form. It is a switch on the switch, and the reason every macropinocytosis assay includes an EIPA control.',
    ],
    kong: 'The control lane in Kong\'s own shape assay: what EIPA does to ruffles, cups and rings is the yardstick a RAC1 compound is measured against.',
  },
  {
    symbol: 'ARF6', source: 'machinery', station: 'cup', role: 'Closing the cup',
    hook: 'The GTPase that brings membrane to the ruffle and takes the vesicle away.',
    what: [
      'ARF6 is a small GTPase of the ARF family, the one that lives at the plasma membrane rather than the Golgi. It runs a recycling loop — endosome to surface and back — and turns on the kinase that makes PIP2, the lipid PIK3CA later converts. Its snapshot associations are few and modest; it is machinery, not a driver.',
      'Overexpression is reported in invasive tumours, where it feeds the invadopodia and membrane traffic a moving cell needs.',
    ],
    route: [
      'A ruffle is a lot of membrane, and ARF6 is part of how the cell supplies it, recycling surface back to the leading edge and priming the PIP2 the cup will need. Once the macropinosome has closed, ARF6-driven traffic is one of the routes by which its membrane returns to the surface for the next one.',
    ],
    kong: 'Downstream housekeeping; not a target, but part of why blocking the ruffle upstream stops the whole cycle rather than one vesicle.',
  },
  {
    symbol: 'RAB5A', source: 'machinery', station: 'early', role: 'Early traffic',
    hook: 'The first label a new macropinosome wears.',
    what: [
      'RAB5A is the small GTPase of the early endosome. It recruits the enzyme that decorates a young vesicle with PI3P and the tethers that let it fuse with others, and it hands the cargo on to the sorting machinery. Its associations in the snapshot are infections and inflammation — tuberculosis first — because pathogens that live inside cells spend a lot of effort manipulating it.',
      'The gene is one of a trio; RAB5A, B and C overlap, which is part of why the disease list is short.',
    ],
    route: [
      'Within a minute or two of closing, a macropinosome acquires RAB5, then trades it for RAB7 as it matures: a conversion that the field uses to stage the vesicle\'s journey. Without RAB5 the macropinosome forms but goes nowhere useful, and the protein it swallowed is never digested.',
    ],
    kong: 'A stage marker for the assay rather than a target: the shapes Kong\'s readout counts — cups, rings, closed vesicles — are the same ones RAB5 labels.',
  },
  {
    symbol: 'RAB7A', source: 'machinery', station: 'late', role: 'Late traffic',
    hook: 'The label that sends the meal to the lysosome.',
    what: [
      'RAB7A is RAB5A\'s successor on the late endosome. It recruits the motors that carry a vesicle inward and the tethers that fuse it with the lysosome, where acid hydrolases take the cargo apart. Germline RAB7A variants cause an axonal Charcot-Marie-Tooth disease, CMT2B, which is the top of the snapshot\'s list; its neurodegenerative associations are the same traffic failing in long neurons.',
    ],
    route: [
      'A macropinosome only feeds the cell once it reaches the lysosome, and RAB7 is what gets it there. The protein it carried becomes amino acids in the lysosomal lumen — the amino acids MTOR will sense in the next station. Block RAB7 and the vesicle stalls, full and useless.',
    ],
    kong: 'The end of the vesicle\'s road. Kong\'s programmes stop the drinking at the start of it, but the lysosomal step is the one that turns a swallowed protein into growth.',
  },
  {
    symbol: 'MTOR', source: 'machinery', station: 'sensing', role: 'Sensing',
    hook: 'The sensor that reads the meal — and, inhibited, lets the cell eat more of it.',
    what: [
      'MTOR is the kinase at the centre of the cell\'s growth accounting. As mTORC1 it sits on the lysosome and switches on protein synthesis when amino acids are plentiful; as mTORC2 it feeds back to AKT. Its germline associations in the snapshot are cortical malformations and overgrowth — the kinase left on in a developing brain — and it is heavily drugged: the rapalogs have been in the clinic for two decades, and the ledger lists candidates at approval.',
    ],
    route: [
      'The relationship with macropinocytosis is a twist. mTORC1 senses the amino acids the lysosome releases from scavenged protein, but it also suppresses the cell\'s use of that protein in favour of free amino acids. Inhibit mTORC1 in a RAS-mutant cell and it turns to the macropinosome, degrading extracellular protein faster and growing on it — which is one reason rapalogs alone underperform in these tumours.',
    ],
    kong: 'The reason to shut the drinking rather than the sensor: a cell whose mTORC1 is off eats more from the macropinosome, not less. Taking away the macropinosome removes the escape route.',
  },
  {
    symbol: 'HIF1A', source: 'machinery', station: 'sensing', role: 'Sensing',
    hook: 'The oxygen sensor that turns the appetite up.',
    what: [
      'HIF1A encodes the α subunit of hypoxia-inducible factor 1. In air it is hydroxylated and destroyed within minutes; when oxygen runs short it survives, pairs with its partner and switches on the hypoxic programme — glycolysis, angiogenesis, and a metabolism that does without mitochondria. The snapshot\'s associations are kidney, breast and colorectal cancers, where the programme is chronically on.',
    ],
    route: [
      'The inside of a solid tumour is hypoxic, and hypoxia turns macropinocytosis up: several groups report more ruffling and more scavenged protein in low oxygen, through HIF-1 and the lipid signalling it drives. The hungriest cells are the ones furthest from a vessel, drinking because nothing else reaches them.',
    ],
    kong: 'The environment Kong\'s compounds have to work in. A tumour core that is starving and hypoxic is exactly where a cell leans hardest on the ruffle — and where cutting it costs the most.',
  },
];

export const GENE_ORDER = GENE_STORIES.map((g) => g.symbol);

export function geneStory(symbol: string): GeneStory | undefined {
  return GENE_STORIES.find((g) => g.symbol === symbol.toUpperCase());
}
