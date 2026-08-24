import { useEffect, useMemo, useRef, useState } from 'react'
import { useShared, useEphemeral, useSurface, useCommand, useSend, usePeers } from '@dualscreen/react'
import { CELLS } from '../lib/data.js'
import { pointsInBrush, ScatterPlot, type BrushRect } from '../components/ScatterPlot.js'

/**
 * DEMO 3 — Linked brushing.
 *
 * The high-frequency case. Pointer moves fire far faster than any sane message
 * rate, so hover state is published with `useEphemeral`, which coalesces writes
 * onto animation frames — one message per frame, whatever the input does — and
 * keeps the value out of the snapshot handed to a window that opens later.
 *
 * The latency readout is a real measurement, not a claim: the driving window
 * stamps a counter, the follower echoes it back, and the round trip is timed
 * against the driver's own clock.
 */

const SURFACE = 'markers'

/** Two views of one population: the embedding, and the marker intensities. */
const EMBEDDING = CELLS.map((c) => ({ id: c.id, x: c.x, y: c.y }))
const MARKERS = CELLS.map((c) => ({ id: c.id, x: c.cd3, y: c.cd19 }))

/** Rolling round-trip timer, driven from whichever window is measuring. */
function useRoundTrip(active: boolean) {
  const [samples, setSamples] = useState<number[]>([])
  const pending = useRef(new Map<number, number>())
  const seq = useRef(0)
  const send = useSend()

  useCommand<number>('latency-pong', (id) => {
    const started = pending.current.get(id)
    if (started === undefined) return
    pending.current.delete(id)
    setSamples((prev) => [...prev.slice(-24), performance.now() - started])
  })

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      const id = (seq.current += 1)
      // Timed against this window's own clock only — the two windows have
      // different `performance.now()` origins, so a one-way measurement
      // between them would be meaningless.
      pending.current.set(id, performance.now())
      send('latency-ping', id)
      if (pending.current.size > 12) pending.current.clear()
    }, 400)
    return () => clearInterval(timer)
  }, [active, send])

  const median = useMemo(() => {
    if (samples.length === 0) return null
    const sorted = [...samples].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]!
  }, [samples])

  return { median, count: samples.length }
}

export function BrushingMain() {
  const markers = useSurface(SURFACE)
  const peers = usePeers()
  const [hoverId, setHoverId] = useEphemeral<number | null>('hoverCell', null)
  const [brush, setBrush] = useShared<BrushRect | null>('brush', null)
  const { median, count } = useRoundTrip(markers.isConnected)

  const selected = useMemo(() => pointsInBrush(EMBEDDING, brush), [brush])

  return (
    <div className="pane">
      <div className="pane-header">
        Embedding
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
          {markers.isConnected && (
            <span className="badge live">
              {median === null ? `measuring… (${count})` : `round trip ${median.toFixed(2)} ms`}
            </span>
          )}
          <span className={markers.isConnected ? 'badge live' : 'badge'}>
            {markers.isConnected ? '● markers connected' : '○ markers closed'}
          </span>
        </span>
      </div>

      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="chart-wrap" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <p className="chart-title">UMAP embedding — {CELLS.length} cells</p>
          <p className="chart-sub">Move the pointer to track a cell. Drag to brush a region.</p>
          <div style={{ flex: '1 1 auto', minHeight: 220 }}>
            <ScatterPlot
              data={EMBEDDING}
              xLabel="UMAP-1"
              yLabel="UMAP-2"
              selected={selected}
              hoverId={hoverId}
              brush={brush}
              onHover={setHoverId}
              onBrush={setBrush}
            />
          </div>
          <div className="controls">
            <button className="ghost" onClick={() => setBrush(null)} disabled={!brush}>
              Clear brush
            </button>
            <span className="hint">
              {selected.size > 0
                ? `${selected.size} cells selected`
                : `${peers.length} window${peers.length === 1 ? '' : 's'} connected`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BrushingMarkers() {
  const [hoverId, setHoverId] = useEphemeral<number | null>('hoverCell', null)
  const [brush] = useShared<BrushRect | null>('brush', null)
  const send = useSend()

  // Echo the latency probe straight back to whoever sent it.
  useCommand<number>('latency-ping', (id, from) => send('latency-pong', id, { to: from }))

  const selected = useMemo(() => pointsInBrush(EMBEDDING, brush), [brush])
  const hovered = hoverId === null ? null : CELLS[hoverId]

  return (
    <div className="pane">
      <div className="pane-header">
        Marker intensities
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }} className="badge">
          {selected.size > 0 ? `${selected.size} brushed` : 'no selection'}
        </span>
      </div>

      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="chart-wrap" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <p className="chart-title">CD19 against CD3</p>
          <p className="chart-sub">
            Same cells, different axes. The crosshair follows the other window's pointer; hovering here drives
            it back.
          </p>
          <div style={{ flex: '1 1 auto', minHeight: 220 }}>
            <ScatterPlot
              data={MARKERS}
              xLabel="CD3 intensity"
              yLabel="CD19 intensity"
              selected={selected}
              hoverId={hoverId}
              brush={null}
              onHover={setHoverId}
            />
          </div>
          {hovered && (
            <dl className="kv" style={{ padding: '10px 0 0' }}>
              <dt>Cell</dt>
              <dd>#{hovered.id}</dd>
              <dt>CD3 / CD19</dt>
              <dd>
                {hovered.cd3.toFixed(2)} / {hovered.cd19.toFixed(2)}
              </dd>
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

export const brushingDemo = {
  id: 'brushing',
  path: '/brushing',
  title: 'Linked brushing',
  surface: SURFACE,
  channel: 'dualscreen-demo-brushing',
  blurb:
    'The high-frequency case. Move your pointer over either plot and a crosshair tracks the same cell in the other window. Drag to brush a region and both views highlight the same cells. The round-trip time in the header is measured live, not asserted.',
  footnote: (
    <>
      <strong>What this shows.</strong> <code>useEphemeral</code> coalesces writes onto animation frames, so a
      60fps pointer stream sends at most one message per frame and never floods the channel — and the value is
      excluded from the snapshot given to a window that opens later, because a cursor position from thirty
      seconds ago is <em>wrong</em>, not merely stale. The brush travels as a{' '}
      <strong>rectangle in data space</strong>, four numbers, rather than a list of matching ids — so the cost
      does not grow with the selection, and the follower can apply it to completely different axes.
    </>
  ),
  Main: BrushingMain,
  Surface: BrushingMarkers,
}
