import { useMemo, useRef, useState } from 'react'
import { useSize } from '../lib/useSize.js'

export interface ScatterDatum {
  id: number
  x: number
  y: number
}

/** A rectangle in data space, so it survives crossing between windows. */
export interface BrushRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Props {
  data: ScatterDatum[]
  xLabel: string
  yLabel: string
  /** Ids selected by the brush, in either window. */
  selected: Set<number>
  /** Id under the pointer, in either window. */
  hoverId: number | null
  /** Brush rectangle to draw, in data space. */
  brush: BrushRect | null
  onHover?: (id: number | null) => void
  /** Omit to make this panel read-only. */
  onBrush?: (rect: BrushRect | null) => void
}

const MARGIN = { top: 14, right: 16, bottom: 34, left: 42 }

/**
 * A scatter panel that can both drive and follow a brush.
 *
 * The brush is published as a rectangle in *data* coordinates, never as a list
 * of selected ids. Two reasons: a rectangle is four numbers regardless of how
 * many points it covers, and the two panels plot different axes at different
 * pixel sizes, so screen coordinates would be meaningless on the other side.
 */
export function ScatterPlot({ data, xLabel, yLabel, selected, hoverId, brush, onHover, onBrush }: Props) {
  const [wrapRef, size] = useSize<HTMLDivElement>()
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const width = Math.max(size.width, 240)
  const height = Math.max(size.height, 200)
  const plotWidth = width - MARGIN.left - MARGIN.right
  const plotHeight = height - MARGIN.top - MARGIN.bottom

  const scales = useMemo(() => {
    const xs = data.map((d) => d.x)
    const ys = data.map((d) => d.y)
    const pad = 0.06
    const xMin = Math.min(...xs)
    const xMax = Math.max(...xs)
    const yMin = Math.min(...ys)
    const yMax = Math.max(...ys)
    const xSpan = (xMax - xMin) || 1
    const ySpan = (yMax - yMin) || 1
    const x0 = xMin - xSpan * pad
    const x1 = xMax + xSpan * pad
    const y0 = yMin - ySpan * pad
    const y1 = yMax + ySpan * pad
    return {
      x: (v: number) => MARGIN.left + ((v - x0) / (x1 - x0)) * plotWidth,
      y: (v: number) => MARGIN.top + plotHeight - ((v - y0) / (y1 - y0)) * plotHeight,
      invX: (px: number) => x0 + ((px - MARGIN.left) / plotWidth) * (x1 - x0),
      invY: (py: number) => y0 + ((MARGIN.top + plotHeight - py) / plotHeight) * (y1 - y0),
      domain: { x0, x1, y0, y1 },
    }
  }, [data, plotWidth, plotHeight])

  const points = useMemo(
    () => data.map((d) => ({ d, cx: scales.x(d.x), cy: scales.y(d.y) })),
    [data, scales],
  )

  const local = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const nearest = (px: number, py: number) => {
    let best: number | null = null
    let bestDistance = 16 * 16
    for (const point of points) {
      const dx = point.cx - px
      const dy = point.cy - py
      const distance = dx * dx + dy * dy
      if (distance < bestDistance) {
        bestDistance = distance
        best = point.d.id
      }
    }
    return best
  }

  const brushPixels = brush
    ? {
        x: Math.min(scales.x(brush.x0), scales.x(brush.x1)),
        y: Math.min(scales.y(brush.y0), scales.y(brush.y1)),
        width: Math.abs(scales.x(brush.x1) - scales.x(brush.x0)),
        height: Math.abs(scales.y(brush.y1) - scales.y(brush.y0)),
      }
    : null

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${yLabel} against ${xLabel}, ${data.length} points`}
        style={{ display: 'block', touchAction: 'none', cursor: onBrush ? 'crosshair' : 'default' }}
        onPointerDown={(event) => {
          if (!onBrush) return
          const point = local(event)
          dragStart.current = point
          setDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
          onBrush(null)
        }}
        onPointerMove={(event) => {
          const point = local(event)
          if (dragging && dragStart.current && onBrush) {
            onBrush({
              x0: scales.invX(dragStart.current.x),
              y0: scales.invY(dragStart.current.y),
              x1: scales.invX(point.x),
              y1: scales.invY(point.y),
            })
            return
          }
          onHover?.(nearest(point.x, point.y))
        }}
        onPointerUp={() => {
          dragStart.current = null
          setDragging(false)
        }}
        onPointerLeave={() => {
          onHover?.(null)
        }}
      >
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          fill="none"
          stroke="var(--grid)"
          strokeWidth={1}
        />

        {points.map(({ d, cx, cy }) => {
          const isSelected = selected.has(d.id)
          const isHovered = d.id === hoverId
          return (
            <circle
              key={d.id}
              cx={cx}
              cy={cy}
              r={isHovered ? 5 : isSelected ? 3.2 : 2.4}
              fill={isSelected || isHovered ? 'var(--accent)' : 'var(--neutral-mid)'}
              opacity={selected.size > 0 && !isSelected && !isHovered ? 0.28 : isSelected ? 0.95 : 0.55}
              stroke={isHovered ? 'var(--surface-0)' : 'none'}
              strokeWidth={isHovered ? 2 : 0}
            />
          )
        })}

        {brushPixels && brushPixels.width > 1 && (
          <rect
            {...brushPixels}
            fill="var(--accent)"
            fillOpacity={0.1}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}

        {/* Crosshair marking the pointer position mirrored from the other window */}
        {hoverId !== null &&
          (() => {
            const point = points.find((p) => p.d.id === hoverId)
            if (!point) return null
            return (
              <g pointerEvents="none" opacity={0.7}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotWidth}
                  y1={point.cy}
                  y2={point.cy}
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <line
                  x1={point.cx}
                  x2={point.cx}
                  y1={MARGIN.top}
                  y2={MARGIN.top + plotHeight}
                  stroke="var(--accent)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              </g>
            )
          })()}

        <text
          x={MARGIN.left + plotWidth / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-secondary)"
        >
          {xLabel}
        </text>
        <text
          transform={`rotate(-90 11 ${MARGIN.top + plotHeight / 2})`}
          x={11}
          y={MARGIN.top + plotHeight / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--text-secondary)"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  )
}

/** Which points fall inside a data-space rectangle. */
export function pointsInBrush(data: ScatterDatum[], brush: BrushRect | null): Set<number> {
  if (!brush) return new Set()
  const xMin = Math.min(brush.x0, brush.x1)
  const xMax = Math.max(brush.x0, brush.x1)
  const yMin = Math.min(brush.y0, brush.y1)
  const yMax = Math.max(brush.y0, brush.y1)
  const out = new Set<number>()
  for (const d of data) {
    if (d.x >= xMin && d.x <= xMax && d.y >= yMin && d.y <= yMax) out.add(d.id)
  }
  return out
}
