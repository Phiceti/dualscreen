/**
 * `@dualscreen/screens` — display detection and window placement.
 *
 * Placement is a progressive enhancement. Where the Window Management API is
 * available and granted, windows land on the right monitor automatically;
 * everywhere else they open as ordinary popups the user positions once. The
 * cross-window synchronisation in `@dualscreen/core` is unaffected either way.
 */

export {
  getScreenLayout,
  requestScreenLayout,
  getScreenPermission,
  getScreenDetails,
  isWindowManagementSupported,
  isExtendedDisplay,
  pickTargetScreen,
  watchScreens,
} from './screens.js'
export type { ScreenInfo, ScreenLayout, ScreenPermission, PlacementMode } from './screens.js'

export {
  openSurfaceWindow,
  placementForScreen,
  enterFullscreenOnScreen,
  shouldAutoFullscreen,
  PopupBlockedError,
  CrossOriginSurfaceError,
  FULLSCREEN_PARAM,
} from './open.js'
export type { OpenSurfaceOptions, SurfaceWindow, Placement } from './open.js'

export type { ScreenDetailed, ScreenDetails } from './dom.js'
