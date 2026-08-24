/**
 * Minimal typings for the Window Management API.
 *
 * These are hand-written rather than pulled from `lib.dom` because the API is
 * still limited-availability and TypeScript's bundled DOM types do not
 * reliably include it. Everything here is feature-detected before use.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API
 */

/** One physical display, as reported by the Window Management API. */
export interface ScreenDetailed extends Screen {
  /** X offset of the screen within the virtual desktop. */
  readonly left: number
  /** Y offset of the screen within the virtual desktop. */
  readonly top: number
  /** X offset of the usable area (excludes docks, taskbars, menu bars). */
  readonly availLeft: number
  /** Y offset of the usable area. */
  readonly availTop: number
  /** True for the OS-designated primary display. */
  readonly isPrimary: boolean
  /** True for a built-in display, e.g. a laptop panel. */
  readonly isInternal: boolean
  /** Ratio of device pixels to CSS pixels on this screen. */
  readonly devicePixelRatio: number
  /** OS-provided display name, when the browser exposes one. */
  readonly label: string
}

/** Live view of the attached displays. */
export interface ScreenDetails extends EventTarget {
  readonly screens: ScreenDetailed[]
  readonly currentScreen: ScreenDetailed
  onscreenschange: ((this: ScreenDetails, ev: Event) => unknown) | null
  oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => unknown) | null
}

/** `window` augmented with the bits we feature-detect. */
export interface WindowWithScreenDetails extends Window {
  getScreenDetails?: () => Promise<ScreenDetails>
}

/** `screen` augmented with the extended-display flag. */
export interface ScreenWithExtended extends Screen {
  isExtended?: boolean
}

/** Fullscreen options carrying a target screen. Chromium-only. */
export interface FullscreenOptionsWithScreen extends FullscreenOptions {
  screen?: ScreenDetailed
}
