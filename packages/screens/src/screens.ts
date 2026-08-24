import type { ScreenDetailed, ScreenDetails, ScreenWithExtended, WindowWithScreenDetails } from './dom.js'

/**
 * Display enumeration, and an honest account of what this browser will let you
 * do with it.
 *
 * The Window Management API — `window.getScreenDetails()` — is what makes a
 * window land on the second monitor without the user dragging it. As of this
 * writing it ships in Chromium only; Firefox and Safari have not implemented
 * it. That is a real constraint and this package does not paper over it. What
 * it does instead is degrade along a defined ladder, so the *synchronisation*
 * — the part that actually matters — never depends on the browser at all.
 * Only the convenience of automatic placement does.
 */

/** How much control this browser grants over window placement. */
export type PlacementMode =
  /** Permission granted and a second display is attached — place automatically. */
  | 'auto'
  /** A window can be opened, but the user must move it. */
  | 'manual'
  /** One display: render both surfaces in a single window instead. */
  | 'split'

/** State of the `window-management` permission. */
export type ScreenPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

/** A display, normalised so callers never touch the raw API. */
export interface ScreenInfo {
  /** Stable-enough identifier derived from geometry and label. */
  id: string
  /** OS display name where available, otherwise a generated label. */
  label: string
  left: number
  top: number
  width: number
  height: number
  /** Usable bounds, excluding docks, taskbars, and menu bars. */
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary: boolean
  isInternal: boolean
  devicePixelRatio: number
  /** True for the display currently showing this window. */
  isCurrent: boolean
}

/** Everything known about the current display arrangement. */
export interface ScreenLayout {
  screens: ScreenInfo[]
  /** The display showing this window, when it can be determined. */
  current: ScreenInfo | null
  /** True when more than one display is attached. */
  isExtended: boolean
  permission: ScreenPermission
  /** What placement this browser will actually allow right now. */
  mode: PlacementMode
}

/** True when this browser implements the Window Management API. */
export function isWindowManagementSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as WindowWithScreenDetails).getScreenDetails === 'function'
}

/**
 * True when the browser reports more than one display.
 *
 * `screen.isExtended` is readable without any permission prompt, which makes
 * it the right thing to gate UI on: you can decide whether to show a "send to
 * second screen" button before ever asking the user for anything.
 */
export function isExtendedDisplay(): boolean {
  if (typeof screen === 'undefined') return false
  return (screen as ScreenWithExtended).isExtended === true
}

/** Read the `window-management` permission without prompting. */
export async function getScreenPermission(): Promise<ScreenPermission> {
  if (!isWindowManagementSupported()) return 'unsupported'
  if (typeof navigator === 'undefined' || !navigator.permissions) return 'prompt'
  try {
    // The permission name is not in the standard PermissionName union yet.
    const status = await navigator.permissions.query({ name: 'window-management' as PermissionName })
    return status.state as ScreenPermission
  } catch {
    // Chromium shipped this as `window-placement` before renaming it.
    try {
      const legacy = await navigator.permissions.query({ name: 'window-placement' as PermissionName })
      return legacy.state as ScreenPermission
    } catch {
      return 'prompt'
    }
  }
}

function toScreenInfo(screen: ScreenDetailed, current: ScreenDetailed | null, index: number): ScreenInfo {
  const label = screen.label || `Display ${index + 1}`
  return {
    id: `${label}@${screen.left},${screen.top},${screen.width}x${screen.height}`,
    label,
    left: screen.left,
    top: screen.top,
    width: screen.width,
    height: screen.height,
    availLeft: screen.availLeft,
    availTop: screen.availTop,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    isPrimary: screen.isPrimary,
    isInternal: screen.isInternal,
    devicePixelRatio: screen.devicePixelRatio,
    isCurrent: current != null && screen.left === current.left && screen.top === current.top,
  }
}

/** Describe the single display we can see without any special API. */
function singleScreenLayout(permission: ScreenPermission): ScreenLayout {
  if (typeof screen === 'undefined') {
    return { screens: [], current: null, isExtended: false, permission, mode: 'split' }
  }
  const only: ScreenInfo = {
    id: `primary@0,0,${screen.width}x${screen.height}`,
    label: 'Primary display',
    left: 0,
    top: 0,
    width: screen.width,
    height: screen.height,
    availLeft: 0,
    availTop: 0,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    isPrimary: true,
    isInternal: true,
    devicePixelRatio: typeof devicePixelRatio === 'number' ? devicePixelRatio : 1,
    isCurrent: true,
  }
  const extended = isExtendedDisplay()
  return {
    screens: [only],
    current: only,
    isExtended: extended,
    permission,
    // We know a second display exists but cannot address it — a popup the user
    // drags is still better than nothing.
    mode: extended ? 'manual' : 'split',
  }
}

/**
 * Read the display layout **without prompting**.
 *
 * Safe to call on page load. Returns the richest answer available at the
 * current permission level, which is a single-screen view until the user
 * grants `window-management`.
 */
export async function getScreenLayout(): Promise<ScreenLayout> {
  const permission = await getScreenPermission()
  if (permission !== 'granted') return singleScreenLayout(permission)
  return readGrantedLayout(permission)
}

/**
 * Read the display layout, **prompting for permission if needed**.
 *
 * Chromium requires this to be called from a user gesture — wire it to the
 * same click that opens the second window, never to page load.
 */
export async function requestScreenLayout(): Promise<ScreenLayout> {
  if (!isWindowManagementSupported()) return singleScreenLayout('unsupported')
  try {
    return await readGrantedLayout('granted')
  } catch {
    // The user dismissed or denied the prompt. Not an error — just a lower
    // rung on the ladder.
    return singleScreenLayout('denied')
  }
}

async function readGrantedLayout(permission: ScreenPermission): Promise<ScreenLayout> {
  const details = await (window as WindowWithScreenDetails).getScreenDetails!()
  const current = details.currentScreen ?? null
  const screens = details.screens.map((s, i) => toScreenInfo(s, current, i))
  return {
    screens,
    current: screens.find((s) => s.isCurrent) ?? null,
    isExtended: screens.length > 1,
    permission,
    mode: screens.length > 1 ? 'auto' : 'split',
  }
}

/**
 * Subscribe to display changes — a monitor plugged in, unplugged, or
 * rearranged. Only fires where the API is supported and granted.
 */
export async function watchScreens(onChange: (layout: ScreenLayout) => void): Promise<() => void> {
  if (!isWindowManagementSupported()) return () => {}
  let details: ScreenDetails
  try {
    details = await (window as WindowWithScreenDetails).getScreenDetails!()
  } catch {
    return () => {}
  }
  const handler = () => {
    void getScreenLayout().then(onChange)
  }
  details.addEventListener('screenschange', handler)
  details.addEventListener('currentscreenchange', handler)
  return () => {
    details.removeEventListener('screenschange', handler)
    details.removeEventListener('currentscreenchange', handler)
  }
}

/**
 * Choose where a secondary window should go.
 *
 * Prefers a display that is not the one already showing this window — the
 * whole point is to use the *other* monitor — and breaks ties toward the
 * largest external display, which is almost always the one the user means.
 */
export function pickTargetScreen(layout: ScreenLayout): ScreenInfo | null {
  const candidates = layout.screens.filter((s) => !s.isCurrent)
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => {
    if (a.isInternal !== b.isInternal) return a.isInternal ? 1 : -1
    return b.width * b.height - a.width * a.height
  })[0]!
}

/** Raw handle to the underlying API, for callers that need something exotic. */
export async function getScreenDetails(): Promise<ScreenDetails | null> {
  if (!isWindowManagementSupported()) return null
  try {
    return await (window as WindowWithScreenDetails).getScreenDetails!()
  } catch {
    return null
  }
}
