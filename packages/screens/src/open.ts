import type { FullscreenOptionsWithScreen, ScreenDetailed } from './dom.js'
import { getScreenDetails, pickTargetScreen, requestScreenLayout, type ScreenInfo, type ScreenLayout } from './screens.js'

/** Query flag asking a freshly opened surface to go fullscreen on arrival. */
export const FULLSCREEN_PARAM = 'dsfs'

/** Where to put a secondary window. */
export interface Placement {
  left: number
  top: number
  width: number
  height: number
}

export interface OpenSurfaceOptions {
  /** URL to load — normally `surfaceUrl(name)` from `@dualscreen/core`. */
  url: string
  /**
   * Which display to target. `'auto'` picks the best non-current display.
   * `null` leaves placement to the browser.
   */
  screen?: ScreenInfo | 'auto' | null
  /**
   * Ask the opened window to enter fullscreen once it loads. Requires the
   * Window Management API in the child; silently skipped otherwise.
   */
  fullscreen?: boolean
  /** Explicit placement, overriding `screen`. */
  placement?: Partial<Placement>
  /**
   * Window name. Reusing a name refocuses the existing window instead of
   * opening a second one — which is what you want for a named surface.
   */
  name?: string
  /**
   * Persist and restore the window's geometry under this key. Pass `true` to
   * key it by window name.
   */
  remember?: boolean | string
  /** Fraction of the target display to fill when not fullscreen. Default `1`. */
  fill?: number
}

/** A secondary window this page opened. */
export interface SurfaceWindow {
  /** The raw window handle. Cross-origin rules do not apply — it is same-origin. */
  readonly window: Window
  /** The window name used to open it. */
  readonly name: string
  /** Where it was placed, if we placed it. Updated once the layout resolves. */
  readonly placement: Placement | null
  /** False once the window has been closed by anyone. */
  readonly isOpen: boolean
  /** Bring it to the front. */
  focus(): void
  /** Close it. */
  close(): void
  /** Run a callback when the window closes, however it closes. */
  onClose(handler: () => void): () => void
}

/**
 * Thrown when asked to open a window on a different origin.
 *
 * A window opened with `window.open()` receives a `window.opener` reference
 * back to the page that opened it. If the target is cross-origin, that handle
 * lets the opened page navigate its opener — reverse tabnabbing — which turns
 * a surface into a redirect to an attacker's login page.
 *
 * dualscreen never has a legitimate reason to open cross-origin: the whole
 * model rests on `BroadcastChannel`, which is origin-scoped, so a cross-origin
 * window could not join the channel anyway. Refusing is therefore free, and it
 * contains the damage if an application ever derives a surface URL from
 * user-supplied input.
 */
export class CrossOriginSurfaceError extends Error {
  constructor(attempted: string) {
    super(
      `[dualscreen] refusing to open a surface on a different origin (${attempted}). ` +
        'Surfaces must be same-origin — a cross-origin window cannot join the channel, ' +
        'and would receive a window.opener handle back to this page.',
    )
    this.name = 'CrossOriginSurfaceError'
  }
}

/** Thrown when the browser refuses to open the window. */
export class PopupBlockedError extends Error {
  constructor() {
    super(
      '[dualscreen] The browser blocked the popup. Secondary windows must be opened ' +
        'synchronously from a user gesture — call open() directly in a click handler, ' +
        'and do not await anything before it.',
    )
    this.name = 'PopupBlockedError'
  }
}

const STORAGE_PREFIX = 'dualscreen:placement:'

function loadPlacement(key: string): Placement | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Placement>
    if (
      typeof parsed.left === 'number' &&
      typeof parsed.top === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return parsed as Placement
    }
    return null
  } catch {
    // Private mode, blocked storage, corrupt JSON — remembering geometry is a
    // convenience and must never break opening the window.
    return null
  }
}

function savePlacement(key: string, placement: Placement): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(placement))
  } catch {
    /* not important enough to surface */
  }
}

/** Compute a placement that fills a display's usable area. */
export function placementForScreen(screen: ScreenInfo, fill = 1): Placement {
  const clamped = Math.min(Math.max(fill, 0.1), 1)
  const width = Math.round(screen.availWidth * clamped)
  const height = Math.round(screen.availHeight * clamped)
  return {
    // Centre within the display when not filling it completely.
    left: Math.round(screen.availLeft + (screen.availWidth - width) / 2),
    top: Math.round(screen.availTop + (screen.availHeight - height) / 2),
    width,
    height,
  }
}

/**
 * Open a secondary window, placing it on another display where the browser
 * allows it.
 *
 * **Must be called from a user gesture**, and note the ordering below: the
 * `window.open()` call happens *synchronously*, before any `await`. That is
 * deliberate and load-bearing. Browsers only honour a popup while the user
 * gesture is still on the stack, and awaiting even an already-resolved promise
 * is enough to lose it — so asking for screen permission first would get the
 * window blocked every time. We open first with whatever geometry we already
 * know, then resolve the display layout and move the window into place. A
 * same-origin window we opened can be moved without a fresh gesture, so the
 * result is identical and the popup actually appears.
 */
export async function openSurfaceWindow(options: OpenSurfaceOptions): Promise<SurfaceWindow> {
  const name = options.name ?? `dualscreen-${Math.random().toString(36).slice(2, 8)}`
  const rememberKey = options.remember === true ? name : typeof options.remember === 'string' ? options.remember : null

  // --- Everything in this section must stay synchronous. ---

  /** Geometry we can determine without awaiting anything. */
  let placement: Placement | null = null
  if (options.placement?.left !== undefined && options.placement.top !== undefined) {
    placement = {
      left: options.placement.left,
      top: options.placement.top,
      width: options.placement.width ?? 1280,
      height: options.placement.height ?? 800,
    }
  } else if (options.screen && options.screen !== 'auto') {
    placement = placementForScreen(options.screen, options.fill ?? 1)
  } else if (rememberKey) {
    // A remembered position is both a better first guess and, on a repeat
    // open, usually the final answer — so the window rarely visibly jumps.
    placement = loadPlacement(rememberKey)
  }

  const url = new URL(options.url, typeof location !== 'undefined' ? location.href : 'http://localhost')
  // Checked before `window.open`, not after — once the window exists the
  // opener reference has already been handed over.
  if (typeof location !== 'undefined' && url.origin !== location.origin) {
    throw new CrossOriginSurfaceError(url.origin)
  }
  if (options.fullscreen) url.searchParams.set(FULLSCREEN_PARAM, '1')

  const features = placement
    ? `popup=yes,left=${placement.left},top=${placement.top},width=${placement.width},height=${placement.height}`
    : 'popup=yes,width=1280,height=800'

  const child = window.open(url.toString(), name, features)
  if (!child) throw new PopupBlockedError()

  // --- Gesture spent. Awaiting is safe from here on. ---

  const closeHandlers = new Set<() => void>()
  let open = true
  // There is no `close` event observable from the opener, so polling is the
  // only way to notice a user closing the window by hand.
  const poll = setInterval(() => {
    if (!child.closed) return
    open = false
    clearInterval(poll)
    for (const handler of [...closeHandlers]) handler()
    closeHandlers.clear()
  }, 500)

  const applyPlacement = (next: Placement) => {
    placement = next
    try {
      child.moveTo(next.left, next.top)
      child.resizeTo(next.width, next.height)
    } catch {
      /* cross-process timing; the features string already did our best */
    }
  }

  // Now resolve the real display layout. This may prompt for permission, which
  // is fine — the window is already on screen.
  if (options.screen !== null && !options.placement) {
    const layout = await requestScreenLayout()
    const requested = options.screen
    const target =
      requested && requested !== 'auto'
        ? (layout.screens.find((s) => s.id === requested.id) ?? requested)
        : pickTargetScreen(layout)
    if (target && !child.closed) applyPlacement(placementForScreen(target, options.fill ?? 1))
  }

  if (rememberKey) {
    const persist = () => {
      try {
        if (child.closed) return
        savePlacement(rememberKey, {
          left: child.screenX,
          top: child.screenY,
          width: child.outerWidth,
          height: child.outerHeight,
        })
      } catch {
        /* cross-process timing; ignore */
      }
    }
    child.addEventListener('pagehide', persist)
    // Also capture final geometry when the opener is the one going away.
    window.addEventListener('pagehide', persist)
  }

  return {
    window: child,
    name,
    get placement() {
      return placement
    },
    get isOpen() {
      return open && !child.closed
    },
    focus: () => child.focus(),
    close: () => child.close(),
    onClose(handler) {
      closeHandlers.add(handler)
      return () => {
        closeHandlers.delete(handler)
      }
    },
  }
}

/**
 * Enter fullscreen on a specific display. Call this **in the secondary
 * window**, from a user gesture or a load handler where the browser permits it.
 *
 * Falls back to ordinary fullscreen when the Window Management API is absent,
 * which puts the window fullscreen on whatever display it already occupies —
 * still the right outcome once the user has dragged it there.
 */
export async function enterFullscreenOnScreen(
  element: Element = document.documentElement,
  screen?: ScreenInfo,
): Promise<boolean> {
  try {
    let target: ScreenDetailed | undefined
    if (screen) {
      const details = await getScreenDetails()
      target = details?.screens.find((s) => s.left === screen.left && s.top === screen.top)
    }
    const opts: FullscreenOptionsWithScreen = target ? { screen: target } : {}
    await element.requestFullscreen(opts)
    return true
  } catch {
    return false
  }
}

/** True when this window was opened with the "go fullscreen" hint set. */
export function shouldAutoFullscreen(href?: string): boolean {
  const url = href ?? (typeof location !== 'undefined' ? location.href : '')
  if (!url) return false
  try {
    return new URL(url, 'http://localhost').searchParams.get(FULLSCREEN_PARAM) === '1'
  } catch {
    return false
  }
}
