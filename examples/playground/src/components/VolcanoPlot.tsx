import { useMemo, useState } from 'react'
import type { Gene } from '../lib/data.js'
import { FC_THRESHOLD, P_THRESHOLD } from '../lib/data.js'
import { useSize } from '../lib/useSize.js'

interface Props {
  genes: Gene[]
  /** Currently selected gene id, drawn with a ring. */
  selectedId: string | null
  /** Gene under the pointer in *another* window, drawn as a crosshair. */
  peerHoverId?: string | null
  onSelect: (gene: Gene) => void
  onHover?: (gene: Gene | null) => void
}

const MARGIN = { top: 16, right: 18, bottom: 40, left: 48 }

/**
 * Differential-expression volcano plot.
 *
 * Colour encodes polarity, so it is a diverging scale: blue for
 * down-regulated, red for up, neutral grey at the middle for "not
 * significant". Significance is also encoded by opacity and by direct labels
 * on the strongest hits, so identity never rests on colour alone.
 */
export function VolcanoPlot({ genes, selectedId, peerHoverId, onSelect, onHover }: Props) {
  const [wrapRef, size] = useSize<HTMLDivElement>()
  const [hover, setHover] = useState<{ gene: Gene; x: number; y: number } | null>(null)

  const width = Math.max(size.width, 260)
  const height = Math.max(size.height, 220)
  const plotWidth = width - MARGIN.left - MARGIN.right
  const plotHeight = height - MARGIN.top - MARGIN.bottom

  const { points, xScale, yScale, xTicks, yTicks, labelled } = useMemo(() => {
    const maxAbsX = Math.max(3, ...genes.map((g) => Math.abs(g.log2fc))) * 1.05
    const maxY = Math.max(4, ...genes.map((g) => g.negLog10P)) * 1.05

    const xScale = (value: number) => MARGIN.left + ((value + maxAbsX) / (2 * maxAbsX)) * plotWidth
    const yScale = (value: number) => MARGIN.top + plotHeight - (value / maxY) * plotHeight

    const points = genes.map((gene) => ({ gene, cx: xScale(gene.log2fc), cy: yScale(gene.negLog10P) }))

    const step = maxAbsX > 6 ? 3 : maxAbsX > 3 ? 2 : 1
    const xTicks: number[] = []
    for (let v = -Math.floor(maxAbsX / step) * step; v <= maxAbsX; v += step) xTicks.push(v)

    const yStep = maxY > 20 ? 10 : maxY > 10 ? 5 : 2
    const yTicks: number[] = []
    for (let v = 0; v <= maxY; v += yStep) yTicks.push(v)

    // Label only the strongest few hits — a number on every point is noise.
    const labelled = new Set(
      [...genes]
        .filter((g) => g.significant)
        .sort((a, b) => b.negLog10P * Math.abs(b.log2fc) - a.negLog10P * Math.abs(a.log2fc))
        .slice(0, 6)
        .map((g) => g.id),
    )

    return { points, xScale, yScale, xTicks, yTicks, labelled }
  }, [genes, plotWidth, plotHeight])

  /** Nearest point to the pointer — a far bigger hit target than the 3px mark. */
  const findNearest = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    let best: (typeof points)[number] | null = null
    let bestDistance = 18 * 18
    for (const point of points) {
      const dx = point.cx - px
      const dy = point.cy - py
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = point
      }
    }
    return best
  }

  const colourFor = (gene: Gene) =>
    gene.direction === 'up' ? 'var(--pole-up)' : gene.direction === 'down' ? 'var(--pole-down)' : 'var(--neutral-mid)'

  const peerPoint = peerHoverId ? points.find((p) => p.gene.id === peerHoverId) : null
  const selectedPoint = selectedId ? points.find((p) => p.gene.id === selectedId) : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 220 }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Volcano plot of ${genes.length} genes`}
        style={{ display: 'block', touchAction: 'none' }}
        onPointerMove={(event) => {
          const nearest = findNearest(event)
          setHover(nearest ? { gene: nearest.gene, x: nearest.cx, y: nearest.cy } : null)
          onHover?.(nearest?.gene ?? null)
        }}
        onPointerLeave={() => {
          setHover(null)
          onHover?.(null)
        }}
        onClick={() => {
          if (hover) onSelect(hover.gene)
        }}
      >
        {/* Recessive grid */}
        {yTicks.map((tick) => (
          <line
            key={`y${tick}`}
            x1={MARGIN.left}
            x2={MARGIN.left + plotWidth}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}

        {/* Significance thresholds */}
        <line
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={yScale(-Math.log10(P_THRESHOLD))}
          y2={yScale(-Math.log10(P_THRESHOLD))}
          stroke="var(--border-strong)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {[-FC_THRESHOLD, FC_THRESHOLD].map((value) => (
          <line
            key={`fc${value}`}
            x1={xScale(value)}
            x2={xScale(value)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ))}

        {/* Points: non-significant first so hits draw on top */}
        {points
          .filter((p) => !p.gene.significant)
          .map((p) => (
            <circle key={p.gene.id} cx={p.cx} cy={p.cy} r={2.2} fill={colourFor(p.gene)} opacity={0.42} />
          ))}
        {points
          .filter((p) => p.gene.significant)
          .map((p) => (
            <circle
              key={p.gene.id}
              cx={p.cx}
              cy={p.cy}
              r={3.4}
              fill={colourFor(p.gene)}
              stroke="var(--surface-0)"
              strokeWidth={1}
              opacity={0.92}
            />
          ))}

        {/* Direct labels on the strongest hits */}
        {points
          .filter((p) => labelled.has(p.gene.id))
          .map((p) => (
            <text
              key={`label-${p.gene.id}`}
              x={p.cx + (p.gene.log2fc > 0 ? 7 : -7)}
              y={p.cy + 3.5}
              textAnchor={p.gene.log2fc > 0 ? 'start' : 'end'}
              fontSize={10.5}
              fill="var(--text-secondary)"
            >
              {p.gene.symbol}
            </text>
          ))}

        {/* A peer window's pointer, mirrored here as a crosshair */}
        {peerPoint && (
          <g pointerEvents="none">
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={peerPoint.cy}
              y2={peerPoint.cy}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.75}
            />
            <line
              x1={peerPoint.cx}
              x2={peerPoint.cx}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.75}
            />
            <circle cx={peerPoint.cx} cy={peerPoint.cy} r={6} fill="none" stroke="var(--accent)" strokeWidth={2} />
          </g>
        )}

        {/* Selection ring */}
        {selectedPoint && (
          <circle
            cx={selectedPoint.cx}
            cy={selectedPoint.cy}
            r={7}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}

        {/* Axes */}
        <line
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={MARGIN.top + plotHeight}
          y2={MARGIN.top + plotHeight}
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
        {xTicks.map((tick) => (
          <text
            key={`xt${tick}`}
            x={xScale(tick)}
            y={MARGIN.top + plotHeight + 16}
            textAnchor="middle"
            fontSize={10.5}
            fill="var(--text-muted)"
          >
            {tick}
          </text>
        ))}
        {yTicks.map((tick) => (
          <text
            key={`yt${tick}`}
            x={MARGIN.left - 8}
            y={yScale(tick) + 3.5}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--text-muted)"
          >
            {tick}
          </text>
        ))}
        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-secondary)"
        >
          log₂ fold change
        </text>
        <text
          transform={`rotate(-90 12 ${MARGIN.top + plotHeight / 2})`}
          x={12}
          y={MARGIN.top + plotHeight / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-secondary)"
        >
          −log₁₀ p
        </text>
      </svg>

      {hover && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hover.x + 12, width - 150),
            top: Math.max(hover.y - 46, 4),
            pointerEvents: 'none',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: 'var(--shadow)',
            padding: '6px 9px',
            fontSize: 11.5,
            fontFamily: 'var(--mono)',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <strong style={{ fontFamily: 'var(--sans)' }}>{hover.gene.symbol}</strong>
          <br />
          log₂FC {hover.gene.log2fc} · p {hover.gene.pValue.toExponential(1)}
        </div>
      )}
    </div>
  )
}

/** Legend for the volcano, so identity is never colour-alone. */
export function VolcanoLegend({ up, down }: { up: number; down: number }) {
  return (
    <div className="legend">
      <span>
        <i className="swatch" style={{ background: 'var(--pole-up)' }} /> Up-regulated ({up})
      </span>
      <span>
        <i className="swatch" style={{ background: 'var(--pole-down)' }} /> Down-regulated ({down})
      </span>
      <span>
        <i className="swatch" style={{ background: 'var(--neutral-mid)' }} /> Not significant
      </span>
    </div>
  )
}
