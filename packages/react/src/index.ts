/**
 * `@dualscreen/react` — React bindings.
 *
 * The whole surface is four ideas: one provider, two components that decide
 * where they render, and hooks for shared state and window control.
 */

export { DualScreen } from './components.js'
export type { DualScreenProps, SurfaceProps, PaneProps } from './components.js'

export {
  useShared,
  useEphemeral,
  useSharedState,
  useSurface,
  useSurfaceRoute,
  usePeers,
  useLinkReady,
  useIsLeader,
  useCommand,
  useSend,
  useScreens,
} from './hooks.js'
export type { SurfaceHandle, UseSharedOptions } from './hooks.js'

export { useDualScreen, routeKey } from './context.js'
export type { DualScreenContextValue } from './context.js'

// Re-exported so most apps need only this one package installed.
export { MAIN_SURFACE, readSurface, isSecondarySurface, surfaceUrl, createLink } from '@dualscreen/core'
export type { Link, PeerInfo, Transport, LinkOptions } from '@dualscreen/core'
export type { ScreenInfo, ScreenLayout, PlacementMode } from '@dualscreen/screens'
