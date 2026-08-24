import { useShared, useSurface, useEphemeral, usePeers } from '@dualscreen/react'
import { EXPERIMENTS, getExperiment, getGene } from '../lib/data.js'
import { VolcanoLegend, VolcanoPlot } from '../components/VolcanoPlot.js'

/**
 * DEMO 1 — Analysis dashboard.
 *
 * The pattern nearly every analysis tool wants: a work list on one monitor, the
 * thing you selected rendered large on the other.
 *
 * Note what actually crosses the wire. `experimentId` and `geneId` are strings.
 * The 520-row result table never moves — both windows import the same data
 * module and resolve the id locally. Swap that module for your fetch layer and
 * this is production-shaped.
 */

const SURFACE = 'inspector'

export function AnalysisMain() {
  const inspector = useSurface(SURFACE)
  const [experimentId, setExperimentId] = useShared<string | null>('experimentId', null)
  const [geneId, setGeneId] = useShared<string | null>('geneId', null)
  const [, setHoverGene] = useEphemeral<string | null>('hoverGene', null)

  const experiment = getExperiment(experimentId)

  return (
    <div className="pane">
      <div className="pane-header">
        Experiments
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
          <span className={inspector.isConnected ? 'badge live' : 'badge'}>
            {inspector.isConnected ? '● inspector connected' : '○ inspector closed'}
          </span>
        </span>
      </div>

      <div className="pane-body">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Experiment</th>
              <th>Assay</th>
              <th className="num">Up</th>
              <th className="num">Down</th>
            </tr>
          </thead>
          <tbody>
            {EXPERIMENTS.map((row) => (
              <tr
                key={row.id}
                aria-selected={row.id === experimentId}
                onClick={() => {
                  setExperimentId(row.id)
                  setGeneId(null)
                  // Drive the other window's route. Written to shared state, so
                  // it survives a reload of either side.
                  inspector.navigate(`/experiment/${row.id}`)
                }}
              >
                <td className="num">{row.id}</td>
                <td>{row.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{row.assay}</td>
                <td className="num" style={{ color: 'var(--pole-up)' }}>
                  {row.upCount}
                </td>
                <td className="num" style={{ color: 'var(--pole-down)' }}>
                  {row.downCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {experiment && (
          <>
            <div className="pane-header" style={{ borderTop: '1px solid var(--border)' }}>
              Top genes — {experiment.id}
            </div>
            <table className="data">
              <thead>
                <tr>
                  <th>Gene</th>
                  <th className="num">log₂FC</th>
                  <th className="num">p</th>
                  <th>Direction</th>
                </tr>
              </thead>
              <tbody>
                {experiment.genes.slice(0, 40).map((gene) => (
                  <tr
                    key={gene.id}
                    aria-selected={gene.id === geneId}
                    onClick={() => setGeneId(gene.id)}
                    onMouseEnter={() => setHoverGene(gene.id)}
                    onMouseLeave={() => setHoverGene(null)}
                  >
                    <td style={{ fontWeight: 520 }}>{gene.symbol}</td>
                    <td className="num">{gene.log2fc > 0 ? `+${gene.log2fc}` : gene.log2fc}</td>
                    <td className="num">{gene.pValue.toExponential(1)}</td>
                    <td>
                      <span
                        style={{
                          color:
                            gene.direction === 'up'
                              ? 'var(--pole-up)'
                              : gene.direction === 'down'
                                ? 'var(--pole-down)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {gene.direction === 'ns' ? 'not significant' : gene.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

export function AnalysisInspector() {
  const [experimentId] = useShared<string | null>('experimentId', null)
  const [geneId, setGeneId] = useShared<string | null>('geneId', null)
  const [hoverGene] = useEphemeral<string | null>('hoverGene', null)
  const peers = usePeers()

  const experiment = getExperiment(experimentId)
  const gene = getGene(experimentId, geneId)

  if (!experiment) {
    return (
      <div className="pane">
        <div className="pane-header">Inspector</div>
        <div className="empty">
          <strong>Nothing selected yet</strong>
          <p>
            Pick an experiment in the main window. Only its id travels between windows — this one rebuilds
            the plot from its own copy of the data.
          </p>
          <span className="badge">{peers.length} window{peers.length === 1 ? '' : 's'} connected</span>
        </div>
      </div>
    )
  }

  return (
    <div className="pane">
      <div className="pane-header">
        Inspector — {experiment.id}
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }} className="badge">
          {experiment.organism} · n={experiment.samples}
        </span>
      </div>

      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="chart-wrap" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <p className="chart-title">{experiment.name}</p>
          <p className="chart-sub">
            {experiment.genes.length} genes · {experiment.assay} · significance at p &lt; 0.01 and |log₂FC| ≥ 1
          </p>
          <div style={{ flex: '1 1 auto', minHeight: 240 }}>
            <VolcanoPlot
              genes={experiment.genes}
              selectedId={geneId}
              peerHoverId={hoverGene}
              onSelect={(g) => setGeneId(g.id)}
            />
          </div>
          <VolcanoLegend up={experiment.upCount} down={experiment.downCount} />
        </div>

        {gene && (
          <dl className="kv" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}>
            <dt>Gene</dt>
            <dd style={{ fontFamily: 'var(--sans)', fontWeight: 560 }}>{gene.symbol}</dd>
            <dt>log₂ fold change</dt>
            <dd>{gene.log2fc > 0 ? `+${gene.log2fc}` : gene.log2fc}</dd>
            <dt>p-value</dt>
            <dd>{gene.pValue.toExponential(3)}</dd>
            <dt>Base mean</dt>
            <dd>{gene.baseMean}</dd>
            <dt>Call</dt>
            <dd style={{ color: gene.significant ? 'var(--pole-up)' : 'var(--text-muted)' }}>
              {gene.significant ? `significant (${gene.direction})` : 'not significant'}
            </dd>
          </dl>
        )}
      </div>
    </div>
  )
}

export const analysisDemo = {
  id: 'analysis',
  path: '/analysis',
  title: 'Analysis dashboard',
  surface: SURFACE,
  channel: 'dualscreen-demo-analysis',
  blurb:
    'The work-list pattern: results on one monitor, the selected item rendered large on the other. Click an experiment, then a gene — the inspector follows. Only ids cross between windows; each side resolves them against its own copy of the data.',
  footnote: (
    <>
      <strong>What this shows.</strong> <code>useShared</code> replicates the selection, and{' '}
      <code>inspector.navigate()</code> drives the other window's route through shared state, so a reload of
      either window lands back where it was. The 520-row table never crosses the wire — broadcasting rows
      instead of ids is the mistake that makes naive implementations unusable on real datasets.
    </>
  ),
  Main: AnalysisMain,
  Surface: AnalysisInspector,
}
