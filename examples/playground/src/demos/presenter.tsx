import { useEffect, useState } from 'react'
import { useShared, useSurface, useCommand, useSend } from '@dualscreen/react'
import { SLIDES } from '../lib/data.js'

/**
 * DEMO 2 — Presenter mode.
 *
 * One shared value — the slide index — rendered as two completely different
 * UIs. The audience screen shows the slide; the presenter screen shows notes,
 * a timer, and what is coming next.
 *
 * This is the case that mirroring libraries get wrong. The windows are not
 * showing the same thing, and they should not be: the whole value is that they
 * differ. Shared *state*, divergent *views*.
 */

const SURFACE = 'stage'

function useElapsed(running: boolean, resetKey: number) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => setSeconds(0), [resetKey])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [running])
  return seconds
}

const formatTime = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

export function PresenterMain() {
  const stage = useSurface(SURFACE)
  const [index, setIndex] = useShared<number>('slideIndex', 0)
  const [running, setRunning] = useShared<boolean>('timerRunning', false)
  const [resetKey, setResetKey] = useState(0)
  const elapsed = useElapsed(running, resetKey)
  const send = useSend()

  const slide = SLIDES[index] ?? SLIDES[0]!
  const next = SLIDES[index + 1]

  const go = (delta: number) => setIndex((current) => Math.min(SLIDES.length - 1, Math.max(0, current + delta)))

  // Arrow keys drive the deck from whichever window has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') go(1)
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="pane">
      <div className="pane-header">
        Presenter view
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
          <span className={stage.isConnected ? 'badge live' : 'badge'}>
            {stage.isConnected ? '● stage connected' : '○ stage closed'}
          </span>
        </span>
      </div>

      <div className="pane-body" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 30, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsed)}
          </span>
          <button className="ghost" onClick={() => setRunning(!running)}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button
            className="ghost"
            onClick={() => {
              setRunning(false)
              setResetKey((k) => k + 1)
            }}
          >
            Reset
          </button>
          <span className="badge" style={{ marginLeft: 'auto' }}>
            slide {index + 1} / {SLIDES.length}
          </span>
        </div>

        <section
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-1)',
            padding: 16,
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Speaker notes
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{slide.notes}</p>
        </section>

        <section
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-1)',
            padding: 16,
            opacity: next ? 1 : 0.55,
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            Up next
          </p>
          {next ? (
            <>
              <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 560 }}>{next.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{next.bullets.join(' · ')}</p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>End of deck</p>
          )}
        </section>

        <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
          <button className="ghost" onClick={() => go(-1)} disabled={index === 0}>
            ← Previous
          </button>
          <button className="primary" onClick={() => go(1)} disabled={index >= SLIDES.length - 1}>
            Next →
          </button>
          <button
            className="ghost"
            style={{ marginLeft: 'auto' }}
            onClick={() => send('flash')}
            title="Send a one-off command to the stage window"
          >
            Flash the stage
          </button>
        </div>
        <p className="hint">Arrow keys work too — from either window.</p>
      </div>
    </div>
  )
}

export function PresenterStage() {
  const [index] = useShared<number>('slideIndex', 0)
  const [flash, setFlash] = useState(false)
  const slide = SLIDES[index] ?? SLIDES[0]!

  // A command is the right tool for a one-off event: it has no value to
  // remember, so it does not belong in shared state.
  useCommand('flash', () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 420)
  })

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(28px, 6vw, 80px)',
        background: flash ? 'var(--accent)' : 'var(--surface-1)',
        color: flash ? 'var(--accent-ink)' : 'var(--text-primary)',
        transition: 'background 160ms ease, color 160ms ease',
      }}
    >
      <p
        style={{
          margin: '0 0 6px',
          fontFamily: 'var(--mono)',
          fontSize: 'clamp(11px, 1.1vw, 14px)',
          color: flash ? 'var(--accent-ink)' : 'var(--text-muted)',
        }}
      >
        {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
      </p>
      <h2
        style={{
          margin: '0 0 clamp(16px, 3vw, 36px)',
          fontSize: 'clamp(26px, 5.2vw, 68px)',
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          fontWeight: 620,
        }}
      >
        {slide.title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: '1.1em', display: 'grid', gap: 'clamp(8px, 1.4vw, 18px)' }}>
        {slide.bullets.map((bullet) => (
          <li
            key={bullet}
            style={{
              fontSize: 'clamp(15px, 2.2vw, 30px)',
              lineHeight: 1.4,
              color: flash ? 'var(--accent-ink)' : 'var(--text-secondary)',
            }}
          >
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const presenterDemo = {
  id: 'presenter',
  path: '/presenter',
  title: 'Presenter mode',
  surface: SURFACE,
  channel: 'dualscreen-demo-presenter',
  blurb:
    'One shared value — the slide index — rendered as two entirely different interfaces. The stage window shows the slide; this one shows notes, a timer, and what is coming next. Open the stage, then drive it with the arrow keys.',
  footnote: (
    <>
      <strong>What this shows.</strong> Shared state with <strong>divergent views</strong> — the thing
      cross-tab mirroring libraries cannot express, because they assume both windows want to look the same.
      The timer and notes never reach the stage. "Flash the stage" uses <code>send()</code> instead of shared
      state, because a one-off event has no value worth remembering or replaying to a window that opens later.
    </>
  ),
  Main: PresenterMain,
  Surface: PresenterStage,
}
