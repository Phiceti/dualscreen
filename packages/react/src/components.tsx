import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createLink, MAIN_SURFACE, readSurface, type Link, type Transport } from '@dualscreen/core'
import {
  enterFullscreenOnScreen,
  getScreenLayout,
  requestScreenLayout,
  shouldAutoFullscreen,
  watchScreens,
  type PlacementMode,
  type ScreenLayout,
} from '@dualscreen/screens'
import { DualScreenContext, useDualScreen, type OpenSurfaceRecord } from './context.js'

export interface DualScreenProps {
  /** Namespace for this app. Windows only talk to windows on the same channel. */
  channel: string
  /** Override the surface this window renders. Defaults to reading `?ds=` from the URL. */
  role?: string
  /** Values published once, only if no other window already holds the key. */
  initialState?: Record<string, unknown>
  /**
   * Override the placement ladder.
   *
   * `'auto'` (the default) picks the best the browser allows: a placed window
   * on Chromium with a second display, a draggable popup elsewhere, a split
   * pane on one display.
   *
   * `'window'` always opens a real window, even on a single display.
   * `'split'` always renders inline, even when a second display is available —
   * useful for an embedded view, or a "show detail inline" user preference.
   */
  placement?: 'auto' | 'window' | 'split'
  /** Axis for the split fallback. Default `'row'`. */
  splitDirection?: 'row' | 'column'
  /** Initial fraction of the split given to the main pane. Default `0.5`. */
  splitRatio?: number
  /** Replace the transport. Defaults to BroadcastChannel. */
  transport?: Transport
  /** Extra metadata advertised to other windows. */
  meta?: Record<string, unknown>
  /** Log the protocol to the console. */
  debug?: boolean
  children: ReactNode
}

/**
 * Root provider. Wrap your app in it once.
 *
 * ```tsx
 * <DualScreen channel="my-app">
 *   <DualScreen.Main><Workspace /></DualScreen.Main>
 *   <DualScreen.Surface name="inspector"><Inspector /></DualScreen.Surface>
 * </DualScreen>
 * ```
 *
 * Both windows run this exact tree. The secondary window boots at the same URL
 * with `?ds=inspector`, so it renders the matching `Surface` and nothing else —
 * which is why adopting this does not mean building a second entry point.
 */
export function DualScreen(props: DualScreenProps) {
  const {
    channel,
    role: roleProp,
    initialState,
    placement = 'auto',
    splitDirection = 'row',
    splitRatio: initialRatio = 0.5,
    transport,
    meta,
    debug = false,
    children,
  } = props

  const role = roleProp ?? readSurface()
  const isMain = role === MAIN_SURFACE

  // Created during render and re-created if an effect cleanup closed it. React
  // StrictMode runs effect cleanups on a still-mounted component, which would
  // otherwise leave us holding a dead link.
  const linkRef = useRef<Link | null>(null)
  if (!linkRef.current) {
    linkRef.current = createLink({ channel, role, transport, meta, initialState, debug })
  }
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!linkRef.current) {
      linkRef.current = createLink({ channel, role, transport, meta, initialState, debug })
      forceRender((n) => n + 1)
    }
    const link = linkRef.current
    return () => {
      link.close()
      linkRef.current = null
    }
    // Recreating on channel/role change is correct; the other options are read
    // once at construction by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, role])

  const link = linkRef.current!

  const [layout, setLayout] = useState<ScreenLayout | null>(null)
  const [openSurfaces, setOpenSurfaces] = useState<Record<string, OpenSurfaceRecord>>({})
  const [ratio, setRatio] = useState(initialRatio)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Read the layout without prompting — safe on load, and enough to decide
  // whether to show a "second screen" affordance at all.
  useEffect(() => {
    let alive = true
    void getScreenLayout().then((next) => {
      if (alive) setLayout(next)
    })
    let stop: (() => void) | undefined
    void watchScreens((next) => {
      if (alive) setLayout(next)
    }).then((fn) => {
      if (alive) stop = fn
      else fn()
    })
    return () => {
      alive = false
      stop?.()
    }
  }, [])

  // A surface window opened with the fullscreen hint puts itself fullscreen.
  useEffect(() => {
    if (isMain || !shouldAutoFullscreen()) return
    void enterFullscreenOnScreen()
  }, [isMain])

  const refreshLayout = useCallback(async () => {
    const next = await requestScreenLayout()
    setLayout(next)
    return next
  }, [])

  const registerSurface = useCallback((name: string, record: OpenSurfaceRecord) => {
    setOpenSurfaces((prev) => ({ ...prev, [name]: record }))
  }, [])

  const unregisterSurface = useCallback((name: string) => {
    setOpenSurfaces((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // What the browser would give us if we just asked.
  const laddered: PlacementMode = layout?.mode ?? 'split'
  const mode: PlacementMode =
    placement === 'split'
      ? 'split'
      : placement === 'window'
        ? // A real window even on one display — 'manual' means "opened, you
          // position it", which is exactly right here.
          (laddered === 'split' ? 'manual' : laddered)
        : laddered

  const hasInline = isMain && Object.values(openSurfaces).some((s) => s.inline)

  const value = useMemo(
    () => ({
      link,
      role,
      isMain,
      layout,
      mode,
      refreshLayout,
      openSurfaces,
      registerSurface,
      unregisterSurface,
      splitDirection,
      splitRatio: ratio,
      setSplitRatio: setRatio,
      rootRef,
    }),
    [link, role, isMain, layout, mode, refreshLayout, openSurfaces, registerSurface, unregisterSurface, splitDirection, ratio],
  )

  // `display: contents` keeps the wrapper out of the layout entirely until a
  // split pane actually needs it, so adding dualscreen to an app never shifts
  // anything on screen.
  const rootStyle: CSSProperties = hasInline
    ? {
        display: 'flex',
        flexDirection: splitDirection,
        // `flex` covers a column-flex parent; `height` covers a block parent.
        flex: '1 1 auto',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }
    : { display: 'contents' }

  return (
    <DualScreenContext.Provider value={value}>
      <div ref={rootRef} data-dualscreen-root="" data-ds-role={role} data-ds-mode={mode} style={rootStyle}>
        {children}
      </div>
    </DualScreenContext.Provider>
  )
}

export interface PaneProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Renders its children only in the primary window. */
function Main({ children, className, style }: PaneProps) {
  const { isMain, openSurfaces, splitRatio } = useDualScreen()
  const hasInline = isMain && Object.values(openSurfaces).some((s) => s.inline)
  if (!isMain) return null
  if (!hasInline) {
    // No split in play — add no wrapper and no layout of our own.
    return <>{children}</>
  }
  return (
    <div
      data-ds-pane="main"
      className={className}
      style={{ flex: `${splitRatio} 1 0%`, minWidth: 0, minHeight: 0, overflow: 'auto', ...style }}
    >
      {children}
    </div>
  )
}

export interface SurfaceProps extends PaneProps {
  /** Name of the surface, matching what you pass to `useSurface`. */
  name: string
}

/**
 * Renders its children when this window *is* the named surface, or — on a
 * single display — inline beside the main view.
 *
 * The same JSX serves both cases, so there is no second code path to keep in
 * sync and nothing to test twice.
 */
function Surface({ name, children, className, style }: SurfaceProps) {
  const { role, isMain, openSurfaces } = useDualScreen()

  // This window was opened as the surface: fill it.
  if (role === name) {
    return (
      <div
        data-ds-pane="surface"
        data-ds-surface={name}
        className={className}
        style={{ width: '100%', height: '100%', ...style }}
      >
        {children}
      </div>
    )
  }

  if (!isMain || !openSurfaces[name]?.inline) return null

  return (
    <>
      <SplitDivider />
      <InlineSurfacePane name={name} className={className} style={style}>
        {children}
      </InlineSurfacePane>
    </>
  )
}

function InlineSurfacePane({ name, children, className, style }: SurfaceProps) {
  const { splitRatio } = useDualScreen()
  return (
    <div
      data-ds-pane="surface"
      data-ds-surface={name}
      data-ds-inline=""
      className={className}
      style={{ flex: `${1 - splitRatio} 1 0%`, minWidth: 0, minHeight: 0, overflow: 'auto', ...style }}
    >
      {children}
    </div>
  )
}

/** Draggable divider between the split panes. */
function SplitDivider() {
  const { splitDirection, setSplitRatio, rootRef } = useDualScreen()
  const [dragging, setDragging] = useState(false)
  const horizontal = splitDirection === 'row'

  useEffect(() => {
    if (!dragging) return
    const onMove = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const next = horizontal
        ? (event.clientX - rect.left) / rect.width
        : (event.clientY - rect.top) / rect.height
      // Clamp so a pane can never be dragged to zero and become unreachable.
      setSplitRatio(Math.min(0.85, Math.max(0.15, next)))
    }
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, horizontal, setSplitRatio, rootRef])

  return (
    <div
      data-ds-divider=""
      role="separator"
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      onPointerDown={() => setDragging(true)}
      style={{
        flex: '0 0 6px',
        cursor: horizontal ? 'col-resize' : 'row-resize',
        background: dragging ? 'currentColor' : 'rgba(128,128,128,0.25)',
        opacity: dragging ? 0.4 : 1,
        touchAction: 'none',
      }}
    />
  )
}

DualScreen.Main = Main
DualScreen.Surface = Surface
