/**
 * Synthetic datasets for the demos.
 *
 * Everything here is generated from a fixed seed, which is the point: both
 * windows import this module and derive *identical* data locally, so the only
 * thing that ever crosses the wire is an id.
 *
 * That is not a demo shortcut — it is the rule the library is designed around.
 * A real analysis app would swap this module for a fetch behind React Query or
 * SWR and get the same shape: shared state holds `experimentId`, each window
 * resolves that id against its own cache. Broadcasting the rows themselves
 * would structured-clone megabytes into every window on every selection.
 */

/** Deterministic PRNG (mulberry32) — same seed, same sequence, every window. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box–Muller transform, so the point clouds look like real measurements. */
function gaussian(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const GENE_PREFIXES = [
  'TP', 'BRCA', 'EGFR', 'MYC', 'KRAS', 'PTEN', 'RB', 'CDK', 'MDM', 'ATM',
  'STAT', 'JAK', 'MAPK', 'AKT', 'PIK3', 'NOTCH', 'WNT', 'SMAD', 'FOX', 'GATA',
  'SOX', 'HOX', 'IL', 'TNF', 'IFN', 'CXCL', 'CCL', 'HLA', 'CD', 'ITG',
]

export interface Gene {
  id: string
  symbol: string
  /** Log2 fold change. Negative is down-regulated, positive up. */
  log2fc: number
  /** Raw p-value. */
  pValue: number
  /** -log10(p), precomputed for plotting. */
  negLog10P: number
  /** Mean normalised expression. */
  baseMean: number
  significant: boolean
  direction: 'up' | 'down' | 'ns'
}

export interface Experiment {
  id: string
  name: string
  assay: string
  organism: string
  samples: number
  date: string
  genes: Gene[]
  upCount: number
  downCount: number
}

const ASSAYS = ['Bulk RNA-seq', 'scRNA-seq', 'CUT&RUN', 'ATAC-seq', 'Proteomics', 'Bulk RNA-seq']
const ORGANISMS = ['H. sapiens', 'M. musculus', 'H. sapiens', 'D. rerio', 'H. sapiens', 'M. musculus']
const TITLES = [
  'IFN-γ stimulation timecourse',
  'CRISPRi knockdown panel',
  'Tumour vs adjacent normal',
  'Drug response, 48h',
  'Hypoxia vs normoxia',
  'Differentiation day 0–14',
]

/** Significance thresholds, shown in the plot as guide lines. */
export const P_THRESHOLD = 0.01
export const FC_THRESHOLD = 1

function buildGenes(seed: number, count: number): Gene[] {
  const rand = mulberry32(seed)
  const genes: Gene[] = []
  const used = new Set<string>()

  for (let i = 0; i < count; i += 1) {
    let symbol = ''
    // Names must be unique — they double as the row key and the crosshair label.
    do {
      const prefix = GENE_PREFIXES[Math.floor(rand() * GENE_PREFIXES.length)]!
      symbol = `${prefix}${1 + Math.floor(rand() * 96)}`
    } while (used.has(symbol))
    used.add(symbol)

    // Most genes sit near zero; a minority are genuinely differential. Drawing
    // the tail separately is what gives the volcano its shape.
    const isHit = rand() < 0.11
    const log2fc = isHit ? gaussian(rand) * 1.5 + (rand() < 0.5 ? -2.2 : 2.2) : gaussian(rand) * 0.55
    const magnitude = Math.abs(log2fc)
    const noise = Math.abs(gaussian(rand)) * 0.9
    const negLog10P = Math.max(0.02, magnitude * 1.9 + noise * (isHit ? 1.4 : 0.5))
    const pValue = 10 ** -negLog10P
    const significant = pValue < P_THRESHOLD && magnitude >= FC_THRESHOLD

    genes.push({
      id: symbol,
      symbol,
      log2fc: Number(log2fc.toFixed(3)),
      pValue,
      negLog10P: Number(negLog10P.toFixed(3)),
      baseMean: Number((10 ** (rand() * 3.4 + 0.6)).toFixed(1)),
      significant,
      direction: significant ? (log2fc > 0 ? 'up' : 'down') : 'ns',
    })
  }
  return genes.sort((a, b) => b.negLog10P - a.negLog10P)
}

/** The six experiments, built once per window. */
export const EXPERIMENTS: Experiment[] = TITLES.map((name, index) => {
  const genes = buildGenes(1000 + index * 137, 520)
  return {
    id: `EXP-${101 + index}`,
    name,
    assay: ASSAYS[index]!,
    organism: ORGANISMS[index]!,
    samples: 4 + ((index * 3) % 9),
    date: `2026-0${(index % 8) + 1}-${String(4 + index * 3).padStart(2, '0')}`,
    genes,
    upCount: genes.filter((g) => g.direction === 'up').length,
    downCount: genes.filter((g) => g.direction === 'down').length,
  }
})

export function getExperiment(id: string | null): Experiment | null {
  if (!id) return null
  return EXPERIMENTS.find((e) => e.id === id) ?? null
}

export function getGene(experimentId: string | null, geneId: string | null): Gene | null {
  const experiment = getExperiment(experimentId)
  if (!experiment || !geneId) return null
  return experiment.genes.find((g) => g.id === geneId) ?? null
}

/* -------------------------------------------------------------------------
   Linked-brushing dataset: one cell population measured on four axes.
------------------------------------------------------------------------- */

export interface Cell {
  id: number
  /** UMAP-like embedding coordinates. */
  x: number
  y: number
  /** Two independent marker intensities. */
  cd3: number
  cd19: number
  cluster: number
}

export const CELLS: Cell[] = (() => {
  const rand = mulberry32(90210)
  const centres = [
    { x: -3.4, y: 2.1 }, { x: 3.0, y: 2.8 }, { x: 0.4, y: -3.3 },
    { x: 4.1, y: -1.6 }, { x: -2.6, y: -2.2 },
  ]
  const out: Cell[] = []
  for (let i = 0; i < 900; i += 1) {
    const cluster = Math.floor(rand() * centres.length)
    const centre = centres[cluster]!
    out.push({
      id: i,
      x: Number((centre.x + gaussian(rand) * 0.95).toFixed(3)),
      y: Number((centre.y + gaussian(rand) * 0.95).toFixed(3)),
      cd3: Number(Math.max(0, cluster < 2 ? 3.2 + gaussian(rand) * 0.8 : 0.6 + gaussian(rand) * 0.5).toFixed(3)),
      cd19: Number(Math.max(0, cluster >= 3 ? 3.0 + gaussian(rand) * 0.7 : 0.7 + gaussian(rand) * 0.55).toFixed(3)),
      cluster,
    })
  }
  return out
})()

/* -------------------------------------------------------------------------
   Presenter deck.
------------------------------------------------------------------------- */

export interface Slide {
  title: string
  bullets: string[]
  notes: string
}

export const SLIDES: Slide[] = [
  {
    title: 'Two monitors, one app',
    bullets: ['Native apps solved this decades ago', 'Web apps never got the plumbing', 'That is the whole gap'],
    notes: 'Open with the PACS radiology workstation: worklist left, images right. Nobody would ship that as one pane. Ask how many people in the room have two monitors — usually most hands go up.',
  },
  {
    title: 'What people do today',
    bullets: ['Open a second tab', 'Drag it to the other monitor', 'Watch the two go out of sync'],
    notes: 'This is the tell. The behaviour already exists — we are not creating demand, just removing the friction. Pause here; the nodding starts on this slide.',
  },
  {
    title: 'Three problems, not one',
    bullets: ['Place the window — Chromium only', 'Move the messages — already solved', 'Model the state — the actual work'],
    notes: 'Conflating these is why no good package exists. Be honest about the Chromium limit up front; it buys credibility for everything after. Emphasise that only placement is gated — sync works everywhere.',
  },
  {
    title: 'A surface is a route',
    bullets: ['Same app, same URL, ?ds=inspector', 'The main window drives the route', 'No second entry point to build'],
    notes: 'This is the reframing that makes adoption cheap. If they already have routes — and they do — they already have most of this. Land this slide and the rest is detail.',
  },
  {
    title: 'Ship ids, not payloads',
    bullets: ['Broadcast the selector', 'Let each window resolve it', 'Never clone the matrix'],
    notes: 'The failure mode that kills naive implementations: structured-cloning a 200MB dataframe into every window on every click. Say the number out loud — it lands.',
  },
  {
    title: 'It degrades, it does not break',
    bullets: ['Chromium: lands on screen two', 'Safari / Firefox: drag it once', 'One monitor: split pane, same code'],
    notes: 'Close by resizing the window live so they watch it collapse to a split pane. Then take questions — the first one is always about Safari.',
  },
]
