/**
 * `@dualscreen/core` — framework-agnostic cross-window coordination.
 *
 * Everything here works in any browser with `BroadcastChannel`, needs no
 * server, and is safe to use outside React.
 */

export { createLink, MAIN_SURFACE } from './link.js'
export type { Link, LinkDiagnostics, TapHandler, TapDirection } from './link.js'

export {
  readSurface,
  isSecondarySurface,
  surfaceUrl,
  isValidSurfaceName,
  isSafeRoute,
  SURFACE_PARAM,
} from './surface.js'

export { createStateStore, isSafeStateKey } from './state.js'
export type { StateStore, StateListener, SetOptions } from './state.js'

export { createLeaderElection, isWebLocksSupported } from './leader.js'
export type { LeaderElection, LeaderElectionOptions } from './leader.js'

export { createPresence } from './presence.js'
export type { Presence, PresenceOptions } from './presence.js'

export {
  createBroadcastChannelTransport,
  isBroadcastChannelSupported,
  createMemoryTransport,
  resetMemoryTransports,
} from './transport/index.js'

export { Emitter, uid, rafThrottle, throttle, shallowEqual } from './util.js'

export { PROTOCOL_VERSION } from './types.js'
export type {
  Envelope,
  MessageType,
  Transport,
  PeerInfo,
  StateEntry,
  StateMap,
  LinkOptions,
  LinkEvents,
  HelloPayload,
  WelcomePayload,
  PatchPayload,
  NavPayload,
  CmdPayload,
} from './types.js'
