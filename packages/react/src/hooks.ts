import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PeerInfo, SetOptions } from '@dualscreen/core'
import { isSafeRoute, rafThrottle, surfaceUrl, throttle } from '@dualscreen/core'
import {
  openSurfaceWindow,
  PopupBlockedError,
  type OpenSurfaceOptions,
  type ScreenLayout,
} from '@dualscreen/screens'
import { routeKey, useDualScreen } from './context.js'

/** Options for {@link useShared}. */
export interface UseSharedOptions extends SetOptions {
  /**
   * Rate-limit writes. `'raf'` coalesces onto animation frames — the right
   * choice for pointer-driven values, since it caps you at one message per
   * frame no matter how fast events arrive. A number throttles to that many
   * milliseconds.
   */
  throttle?: 'raf' | number
}

/**
 * Read and write a value shared across every window on the channel.
 *
 * Works identically in the main window and in any surface — whoever writes,
 * everyone sees it.
 *
 * ```tsx
 * const [gene, setGene] = useShared<string | null>('gene', null)
 * ```
 *
 * `initialValue` is a **local read fallback only**; it is never written, so
 * mounting a component cannot clobber a value another window already set. To
 * publish real defaults, pass `initialState` to `<DualScreen>`.
 */
export function useShared<T>(
  key: string,
  initialValue?: T,
  options?: UseSharedOptions,
): [T, (value: T | ((previous: T) => T)) => void] {
  const { link } = useDualScreen()

  // Hold the fallback in a ref so an inline object literal does not change
  // identity every render and thrash useSyncExternalStore.
  const fallback = useRef(initialValue as T)

  const subscribe = useCallback((onChange: () => void) => link.subscribeKey(key, onChange), [link, key])
  const getSnapshot = useCallback(() => link.get<T>(key), [link, key])
  const stored = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const value = stored === undefined ? fallback.current : stored

  const ephemeral = options?.ephemeral
  const throttleMode = options?.throttle

  // One publisher per (key, throttle mode), rebuilt only when those change.
  const publish = useMemo(() => {
    const write = (next: unknown) => link.set(key, next, ephemeral ? { ephemeral: true } : undefined)
    if (throttleMode === 'raf') return rafThrottle(write)
    if (typeof throttleMode === 'number') return throttle(write, throttleMode)
    return Object.assign(write, { cancel() {} })
  }, [link, key, ephemeral, throttleMode])

  useEffect(() => () => publish.cancel(), [publish])

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved =
        typeof next === 'function'
          ? (next as (previous: T) => T)((link.get<T>(key) ?? fallback.current) as T)
          : next
      publish(resolved)
    },
    [link, key, publish],
  )

  return [value as T, setValue]
}

/**
 * Shared state for values that describe *right now* — cursor position, hover
 * target, scrub head.
 *
 * Identical to `useShared` with `{ ephemeral: true, throttle: 'raf' }`. Two
 * things follow from that: writes are coalesced to one per animation frame, so
 * a 60fps pointer stream cannot flood the channel; and the value is excluded
 * from the snapshot handed to a late-joining window, because replaying a
 * cursor position from thirty seconds ago is worse than showing nothing.
 */
export function useEphemeral<T>(key: string, initialValue?: T): [T, (value: T | ((previous: T) => T)) => void] {
  return useShared<T>(key, initialValue, { ephemeral: true, throttle: 'raf' })
}

/** Every shared value at once. Prefer `useShared` unless you truly need all keys. */
export function useSharedState(): Record<string, unknown> {
  const { link } = useDualScreen()
  const subscribe = useCallback((onChange: () => void) => link.subscribe(onChange), [link])
  // `getAll` builds a fresh object each call, so cache it and only replace the
  // reference when something actually changed — otherwise React re-renders
  // forever.
  const cache = useRef<Record<string, unknown>>({})
  const version = useRef(0)
  const getSnapshot = useCallback(() => {
    const next = link.getAll()
    const keys = Object.keys(next)
    const prev = cache.current
    const changed =
      keys.length !== Object.keys(prev).length || keys.some((k) => !Object.is(prev[k], next[k]))
    if (changed) {
      cache.current = next
      version.current += 1
    }
    return cache.current
  }, [link])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Handle returned by {@link useSurface}. */
export interface SurfaceHandle {
  /** The surface name. */
  name: string
  /**
   * Open it. **Call this directly inside a click handler** — popup blockers
   * reject windows opened outside a user gesture.
   */
  open: (options?: Partial<OpenSurfaceOptions>) => Promise<void>
  /** Close it. */
  close: () => void
  /** Bring it to the front. */
  focus: () => void
  /** Drive what it shows. Durable: survives a reload of either window. */
  navigate: (to: string) => void
  /** The route it is currently showing, or `null`. */
  route: string | null
  /** True when a window (or split pane) for this surface is showing. */
  isOpen: boolean
  /** True when a peer rendering this surface is actually connected. */
  isConnected: boolean
  /** True while `open()` is in flight. */
  isOpening: boolean
  /** Rendering inline in a split pane instead of its own window. */
  isInline: boolean
  /** What placement the browser allowed. */
  mode: 'auto' | 'manual' | 'split'
  /** Last failure from `open()`, e.g. a blocked popup. */
  error: Error | null
}

/**
 * Control one secondary surface from the main window.
 *
 * ```tsx
 * const inspector = useSurface('inspector')
 * <button onClick={() => inspector.open()}>Open on second screen</button>
 * ```
 *
 * On a single display — or any browser without the Window Management API —
 * `open()` falls back to a split pane or a draggable popup automatically. The
 * calling code does not change.
 */
export function useSurface(name: string): SurfaceHandle {
  const ctx = useDualScreen()
  const { link, mode, openSurfaces, registerSurface, unregisterSurface } = ctx
  const [isOpening, setOpening] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const record = openSurfaces[name]

  // Presence is the authoritative signal: a window that reloaded, or one the
  // user opened by pasting the URL, is just as connected as one we opened.
  const peers = usePeers()
  const isConnected = peers.some((p) => p.role === name)

  const [rawRoute] = useShared<string | null>(routeKey(name), null)
  const route = useSafeRoute(rawRoute)

  const open = useCallback(
    async (options?: Partial<OpenSurfaceOptions>) => {
      setError(null)
      if (record) {
        record.focus()
        return
      }
      // One display and no way to address another: render in a split pane.
      if (mode === 'split') {
        registerSurface(name, { inline: true, close: () => unregisterSurface(name), focus: () => {} })
        return
      }
      setOpening(true)
      try {
        const handle = await openSurfaceWindow({
          url: surfaceUrl(name),
          screen: 'auto',
          name: `dualscreen-${link.channel}-${name}`,
          remember: `${link.channel}:${name}`,
          ...options,
        })
        registerSurface(name, {
          inline: false,
          close: () => handle.close(),
          focus: () => handle.focus(),
        })
        handle.onClose(() => unregisterSurface(name))
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error(String(err))
        setError(wrapped)
        if (wrapped instanceof PopupBlockedError) {
          // A blocked popup is recoverable and the split pane is a genuinely
          // usable answer, so take it rather than showing the user an error.
          registerSurface(name, { inline: true, close: () => unregisterSurface(name), focus: () => {} })
        }
      } finally {
        setOpening(false)
      }
    },
    [record, mode, name, link.channel, registerSurface, unregisterSurface],
  )

  const close = useCallback(() => {
    record?.close()
    unregisterSurface(name)
  }, [record, name, unregisterSurface])

  const focus = useCallback(() => record?.focus(), [record])

  const navigate = useCallback(
    (to: string) => {
      // Written to shared state rather than sent as a one-shot event, so a
      // surface that reloads — or opens late — lands on the right route
      // instead of a blank screen.
      link.set(routeKey(name), to)
    },
    [link, name],
  )

  return {
    name,
    open,
    close,
    focus,
    navigate,
    route,
    isOpen: Boolean(record) || isConnected,
    isConnected,
    isOpening,
    isInline: record?.inline ?? false,
    mode,
    error,
  }
}

/**
 * Reject a route carrying a scheme that executes.
 *
 * Shared state is writable by every script on the origin, so a route is
 * untrusted input by the time it reaches here. Applications routinely hand
 * routes straight to `location.href` or an `<a href>`, which turns a
 * `javascript:` value into script execution — so filter it at the read, where
 * it is cheap and cannot be forgotten.
 */
function useSafeRoute(route: string | null): string | null {
  return useMemo(() => {
    if (route === null || route === undefined) return null
    if (isSafeRoute(route)) return route
    console.error(`[dualscreen] ignoring unsafe route ${JSON.stringify(route)} from shared state.`)
    return null
  }, [route])
}

/**
 * The route this surface has been told to show.
 *
 * Call it in the secondary window with no argument — it reads the surface from
 * context.
 *
 * Routes carrying an executable scheme (`javascript:` and friends) are dropped,
 * but this is a backstop: validate the route against your own route table
 * before using it.
 */
export function useSurfaceRoute(surface?: string): string | null {
  const { role } = useDualScreen()
  const [rawRoute] = useShared<string | null>(routeKey(surface ?? role), null)
  return useSafeRoute(rawRoute)
}

/** Every connected window, including this one. */
export function usePeers(): PeerInfo[] {
  const { link } = useDualScreen()
  const [peers, setPeers] = useState<PeerInfo[]>(() => link.peers)
  useEffect(() => {
    setPeers(link.peers)
    return link.on('peers', setPeers)
  }, [link])
  return peers
}

/** True once the join handshake has settled and shared state is current. */
export function useLinkReady(): boolean {
  const { link } = useDualScreen()
  const [ready, setReady] = useState(() => link.isReady)
  useEffect(() => {
    if (link.isReady) {
      setReady(true)
      return
    }
    return link.on('ready', () => setReady(true))
  }, [link])
  return ready
}

/** Whether this window currently holds leadership. */
export function useIsLeader(): boolean {
  const { link } = useDualScreen()
  const [leader, setLeader] = useState(() => link.isLeader)
  useEffect(() => {
    setLeader(link.isLeader)
    return link.on('leader', setLeader)
  }, [link])
  return leader
}

/**
 * Handle a command sent by another window.
 *
 * The handler is held in a ref, so it can close over fresh props without
 * resubscribing on every render.
 */
export function useCommand<T = unknown>(name: string, handler: (args: T, from: string) => void): void {
  const { link } = useDualScreen()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => link.command(name, (args, from) => ref.current(args as T, from)), [link, name])
}

/** Send a command to other windows. */
export function useSend(): (name: string, args?: unknown, options?: { to?: string }) => void {
  const { link } = useDualScreen()
  return useCallback((name, args, options) => link.send(name, args, options), [link])
}

/** Display layout, plus a way to prompt for the permission that enriches it. */
export function useScreens(): {
  layout: ScreenLayout | null
  mode: 'auto' | 'manual' | 'split'
  isExtended: boolean
  permission: ScreenLayout['permission']
  request: () => Promise<ScreenLayout>
} {
  const { layout, mode, refreshLayout } = useDualScreen()
  return {
    layout,
    mode,
    isExtended: layout?.isExtended ?? false,
    permission: layout?.permission ?? 'unsupported',
    request: refreshLayout,
  }
}
