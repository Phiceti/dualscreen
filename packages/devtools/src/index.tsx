import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Envelope, TapDirection } from '@dualscreen/core'
import { useDualScreen, usePeers, useSharedState } from '@dualscreen/react'

/** One captured protocol message. */
interface LogEntry {
  key: number
  direction: TapDirection
  type: string
  from: string
  to: string
  detail: string
}

export interface DualScreenDevtoolsProps {
  /** Start expanded. Default `false`. */
  defaultOpen?: boolean
  /** Corner to dock to. Default `'bottom-right'`. */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** How many messages to keep. Default `60`. */
  historyLimit?: number
}

/**
 * A floating panel showing who is connected, what the shared state holds, and
 * the protocol traffic as it happens.
 *
 * Debugging two windows is genuinely harder than debugging one — you cannot
 * watch both consoles at once, and the interesting failures are the ones where
 * the windows disagree. Rendering this in *both* windows lets you compare them
 * side by side, which is usually enough to see the problem immediately.
 *
 * Render it inside `<DualScreen>` and strip it in production:
 *
 * ```tsx
 * {import.meta.env.DEV && <DualScreenDevtools />}
 * ```
 */
export function DualScreenDevtools(props: DualScreenDevtoolsProps) {
  const { defaultOpen = false, position = 'bottom-right', historyLimit = 60 } = props
  const { link, role, mode, layout } = useDualScreen()
  const peers = usePeers()
  const state = useSharedState()
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState<'state' | 'peers' | 'traffic'>('state')
  const [log, setLog] = useState<LogEntry[]>([])
  const counter = useRef(0)

  useEffect(() => {
    if (!open || tab !== 'traffic') return
    // Only tap while the traffic tab is visible — the tap runs on the hot path
    // and there is no reason to pay for it when nobody is looking.
    return link.tap((envelope: Envelope, direction) => {
      counter.current += 1
      const entry: LogEntry = {
        key: counter.current,
        direction,
        type: envelope.t,
        from: envelope.from.slice(-4),
        to: envelope.to === '*' ? 'all' : envelope.to.slice(-4),
        detail: summarise(envelope),
      }
      setLog((prev) => [entry, ...prev].slice(0, historyLimit))
    })
  }, [link, open, tab, historyLimit])

  const diagnostics = link.diagnostics
  const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'right']

  const shell: CSSProperties = {
    position: 'fixed',
    [vertical]: 12,
    [horizontal]: 12,
    zIndex: 2147483000,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#e6edf3',
    background: 'rgba(13,17,23,0.94)',
    border: '1px solid rgba(240,246,252,0.15)',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    overflow: 'hidden',
    width: open ? 340 : 'auto',
  }

  if (!open) {
    return (
      <div style={shell}>
        <button onClick={() => setOpen(true)} style={triggerStyle} title="Open dualscreen devtools">
          <Dot ok={peers.length > 1} /> dualscreen · {role} · {peers.length}
        </button>
      </div>
    )
  }

  return (
    <div style={shell}>
      <header style={headerStyle}>
        <span style={{ fontWeight: 600 }}>
          <Dot ok={peers.length > 1} /> {role}
          <span style={{ opacity: 0.5 }}> · {link.id.slice(-4)}</span>
        </span>
        <button onClick={() => setOpen(false)} style={closeStyle} aria-label="Close devtools">
          ×
        </button>
      </header>

      <div style={metaRowStyle}>
        <Meta label="mode" value={mode} />
        <Meta label="leader" value={link.isLeader ? 'this' : 'other'} />
        <Meta label="screens" value={String(layout?.screens.length ?? 1)} />
        <Meta label="↑↓" value={`${diagnostics.sent}/${diagnostics.received}`} />
      </div>

      <nav style={tabsStyle}>
        {(['state', 'peers', 'traffic'] as const).map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            style={{ ...tabStyle, ...(tab === name ? activeTabStyle : null) }}
          >
            {name}
          </button>
        ))}
      </nav>

      <div style={bodyStyle}>
        {tab === 'state' &&
          (Object.keys(state).length === 0 ? (
            <Empty>no shared state yet</Empty>
          ) : (
            Object.entries(state).map(([key, value]) => (
              <div key={key} style={rowStyle}>
                <span style={{ color: '#79c0ff', flexShrink: 0 }}>{key}</span>
                <span style={valueStyle}>{format(value)}</span>
              </div>
            ))
          ))}

        {tab === 'peers' &&
          peers.map((peer) => (
            <div key={peer.id} style={rowStyle}>
              <span style={{ color: peer.id === link.id ? '#7ee787' : '#79c0ff', flexShrink: 0 }}>
                {peer.role}
              </span>
              <span style={valueStyle}>
                {peer.id.slice(-4)}
                {peer.leader ? ' · leader' : ''}
                {peer.id === link.id ? ' · this window' : ''}
              </span>
            </div>
          ))}

        {tab === 'traffic' &&
          (log.length === 0 ? (
            <Empty>waiting for messages…</Empty>
          ) : (
            log.map((entry) => (
              <div key={entry.key} style={rowStyle}>
                <span style={{ color: entry.direction === 'out' ? '#f0883e' : '#7ee787', flexShrink: 0 }}>
                  {entry.direction === 'out' ? '→' : '←'} {entry.type}
                </span>
                <span style={valueStyle}>{entry.detail}</span>
              </div>
            ))
          ))}
      </div>

      <footer style={footerStyle}>
        {diagnostics.transport} · locks:{diagnostics.leaderStrategy === 'web-locks' ? 'yes' : 'no'} · v
        {diagnostics.protocol}
      </footer>
    </div>
  )
}

/** Condense an envelope into one readable line. */
function summarise(envelope: Envelope): string {
  const d = envelope.d as Record<string, unknown> | null
  if (!d) return ''
  if (envelope.t === 'patch') return `${String(d.key)} = ${format((d.entry as { value: unknown })?.value)}`
  if (envelope.t === 'cmd') return String(d.name)
  if (envelope.t === 'hello') return String((d.peer as { role?: string })?.role ?? '')
  if (envelope.t === 'welcome') return `${Object.keys(d.state ?? {}).length} keys`
  return ''
}

function format(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value.length > 40 ? `"${value.slice(0, 40)}…"` : `"${value}"`
  try {
    const json = JSON.stringify(value)
    return json.length > 44 ? `${json.slice(0, 44)}…` : json
  } catch {
    return String(value)
  }
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        marginRight: 6,
        background: ok ? '#3fb950' : '#8b949e',
      }}
    />
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span style={{ opacity: 0.5 }}>{label} </span>
      {value}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ opacity: 0.4, padding: '10px 12px' }}>{children}</div>
}

const triggerStyle: CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  padding: '7px 11px',
  display: 'block',
  color: '#e6edf3',
  font: 'inherit',
}
const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 11px',
  borderBottom: '1px solid rgba(240,246,252,0.1)',
}
const closeStyle: CSSProperties = { all: 'unset', cursor: 'pointer', padding: '0 4px', opacity: 0.6, fontSize: 15 }
const metaRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: '6px 11px',
  borderBottom: '1px solid rgba(240,246,252,0.1)',
  opacity: 0.9,
  flexWrap: 'wrap',
}
const tabsStyle: CSSProperties = { display: 'flex', borderBottom: '1px solid rgba(240,246,252,0.1)' }
const tabStyle: CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  padding: '6px 11px',
  opacity: 0.5,
  font: 'inherit',
  color: '#e6edf3',
}
const activeTabStyle: CSSProperties = { opacity: 1, boxShadow: 'inset 0 -2px 0 #58a6ff' }
const bodyStyle: CSSProperties = { maxHeight: 220, overflowY: 'auto', padding: '4px 0' }
const rowStyle: CSSProperties = { display: 'flex', gap: 8, padding: '2px 11px', whiteSpace: 'nowrap' }
const valueStyle: CSSProperties = { opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' }
const footerStyle: CSSProperties = {
  padding: '5px 11px',
  borderTop: '1px solid rgba(240,246,252,0.1)',
  opacity: 0.45,
  fontSize: 10,
}
