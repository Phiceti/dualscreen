import { useState } from 'react'
import { DualScreen, readSurface, useScreens, useSurface } from '@dualscreen/react'
import { DualScreenDevtools } from '@dualscreen/devtools'
import { useHashRoute } from './lib/router.js'
import { analysisDemo } from './demos/analysis.js'
import { presenterDemo } from './demos/presenter.js'
import { brushingDemo } from './demos/brushing.js'

const DEMOS = [analysisDemo, presenterDemo, brushingDemo]

/**
 * `?embed=1` strips the site chrome and pins placement to `split`, so the demo
 * renders both panes inside an iframe on the docs landing page. Without the
 * pin, a visitor who happens to have two monitors would get 'manual' and the
 * embed would try to open a popup instead of showing anything.
 */
function isEmbedded(): boolean {
  if (typeof location === 'undefined') return false
  return new URLSearchParams(location.search).get('embed') === '1'
}

/**
 * Where the docs site lives, relative to wherever this bundle was deployed.
 *
 * The playground ships under `<docs base>/demo/`, so stripping the trailing
 * `demo/` off Vite's base gets us home — and it stays correct under a GitHub
 * Pages project sub-path. Served standalone (`pnpm demo`) there is no docs
 * site above us, so this is `null` and the link is not rendered rather than
 * pointing somewhere that doesn't exist.
 */
export function docsHomeFrom(base: string): string | null {
  if (!base) return null
  return /(^|\/)demo\/$/.test(base) ? base.replace(/demo\/$/, '') : null
}

const DOCS_HOME: string | null = docsHomeFrom(import.meta.env.BASE_URL || '/')

const REPO_URL = 'https://github.com/phiceti/dualscreen'

/** Wordmark, linking home when there is a home to link to. */
function Brand() {
  const inner = (
    <>
      <svg viewBox="0 0 32 32" width="17" height="17" fill="none" aria-hidden="true">
        <rect x="1.5" y="5.5" width="13" height="21" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
        <rect x="17.5" y="5.5" width="13" height="21" rx="2.5" fill="currentColor" />
      </svg>
      dualscreen <span>· demos</span>
    </>
  )
  if (!DOCS_HOME) return <span className="brand">{inner}</span>
  return (
    <a className="brand" href={DOCS_HOME} title="Back to the dualscreen docs">
      {inner}
    </a>
  )
}

export default function App() {
  const route = useHashRoute()
  const surface = readSurface()
  const isSecondary = surface !== 'main'
  const embed = isEmbedded()
  const demo = DEMOS.find((d) => d.path === route) ?? DEMOS[0]!

  return (
    <div className="app">
      {!isSecondary && !embed && (
        <header className="topbar">
          <Brand />
          <nav className="tabs">
            {DEMOS.map((entry) => (
              <a
                key={entry.id}
                className="tab"
                href={`#${entry.path}`}
                aria-current={entry.id === demo.id ? 'page' : undefined}
              >
                {entry.title}
              </a>
            ))}
          </nav>
          <div className="topbar-end">
            {DOCS_HOME && (
              <a className="tab" href={DOCS_HOME}>
                ← Docs
              </a>
            )}
            <a className="tab" href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </div>
        </header>
      )}

      {/* Recreated per demo so each gets its own channel and clean state. */}
      <DualScreen
        key={demo.id}
        channel={embed ? `${demo.channel}-embed` : demo.channel}
        placement={embed ? 'split' : 'auto'}
      >
        <DualScreen.Main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="workspace">
            {embed ? <EmbedBar demo={demo} /> : <Intro demo={demo} />}
            <demo.Main />
            {!embed && <footer className="footnote">{demo.footnote}</footer>}
          </div>
        </DualScreen.Main>

        <DualScreen.Surface
          name={demo.surface}
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <demo.Surface />
          <SurfaceEscape demo={demo} />
        </DualScreen.Surface>

        {!embed && <DualScreenDevtools />}
      </DualScreen>
    </div>
  )
}

function Intro({ demo }: { demo: (typeof DEMOS)[number] }) {
  const handle = useSurface(demo.surface)
  const { layout, mode, permission } = useScreens()
  const [note, setNote] = useState<string | null>(null)

  const screenCount = layout?.screens.length ?? 1

  const explainMode = () => {
    if (mode === 'auto') return `${screenCount} displays — the window will be placed on the second one`
    if (mode === 'manual')
      return permission === 'unsupported'
        ? 'this browser has no Window Management API — the window opens as a popup you drag once'
        : 'permission not granted yet — the window opens as a popup you can drag'
    return 'one display — the surface renders in a split pane instead'
  }

  return (
    <section className="intro">
      <h1>{demo.title}</h1>
      <p>{demo.blurb}</p>

      <div className="controls">
        {handle.isOpen ? (
          <button className="ghost" onClick={() => handle.close()}>
            Close {demo.surface}
          </button>
        ) : (
          <button
            className="primary"
            disabled={handle.isOpening}
            // Called straight from the click: the popup must open while the
            // user gesture is still live.
            onClick={() => {
              setNote(null)
              void handle.open().catch((err: Error) => setNote(err.message))
            }}
          >
            {handle.isOpening ? 'Opening…' : `Open ${demo.surface} on second screen`}
          </button>
        )}

        <span className="badge">{explainMode()}</span>

        {mode !== 'auto' && permission === 'prompt' && (
          <span className="hint">
            Chromium can place it for you — the first click will ask for display permission.
          </span>
        )}
      </div>

      {note && (
        <p className="hint" style={{ marginTop: 8, color: 'var(--pole-up)' }}>
          {note}
        </p>
      )}
      {handle.isInline && (
        <p className="hint" style={{ marginTop: 8 }}>
          Rendering inline — same component, same state, no code change.
        </p>
      )}
    </section>
  )
}

/**
 * The embedded view's only control: open and close the surface. Everything
 * else the full playground shows is redundant next to the page explaining it.
 */
function EmbedBar({ demo }: { demo: (typeof DEMOS)[number] }) {
  const handle = useSurface(demo.surface)

  return (
    <div className="embedbar">
      <span className="embedbar-title">{demo.title}</span>
      {handle.isOpen ? (
        <button className="ghost" onClick={() => handle.close()}>
          Close {demo.surface}
        </button>
      ) : (
        <button className="primary" onClick={() => void handle.open()}>
          Open {demo.surface}
        </button>
      )}
      <span className="hint">
        {handle.isOpen
          ? 'Rendering inline — on two monitors this is a separate window.'
          : 'Pinned to split mode so it fits in the page.'}
      </span>
    </div>
  )
}

/**
 * A way out of a surface window that was opened directly.
 *
 * Surface popups are opened with `popup=yes`, which strips the address bar —
 * so a surface has no browser navigation of its own. That is fine for a real
 * popup, which the user closes from the window chrome. But someone who lands
 * here from history or a pasted link gets a bare panel with no exit, so offer
 * one exactly then: `window.opener` is set for a popup we opened and null
 * otherwise.
 */
function SurfaceEscape({ demo }: { demo: (typeof DEMOS)[number] }) {
  const isPopup = typeof window !== 'undefined' && window.opener != null
  if (isPopup) return null
  return (
    <a className="surface-escape" href={`${import.meta.env.BASE_URL}#${demo.path}`}>
      ← Back to the {demo.title} demo
    </a>
  )
}
