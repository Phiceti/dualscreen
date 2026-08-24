/**
 * Wire protocol version. Bumped only on breaking envelope changes.
 * Peers on mismatched versions ignore each other rather than crash.
 */
export const PROTOCOL_VERSION = 1 as const

/** Every message that crosses a {@link Transport} is wrapped in an Envelope. */
export interface Envelope<T = unknown> {
  /** Protocol version. */
  p: typeof PROTOCOL_VERSION
  /** Unique message id — used to drop duplicates on lossy transports. */
  id: string
  /** Peer id of the sender. */
  from: string
  /** Peer id of the recipient, or `'*'` to broadcast. */
  to: string | '*'
  /** Message type discriminator. */
  t: MessageType
  /** Lamport clock value at the sender when this was emitted. */
  c: number
  /** Message payload. Shape is determined by {@link MessageType}. */
  d: T
}

/** Discriminator for the built-in protocol messages. */
export type MessageType =
  /** A peer announcing that it joined. Broadcast. */
  | 'hello'
  /** The leader's reply to `hello`: a full state + presence snapshot. */
  | 'welcome'
  /** A peer announcing a clean exit. Broadcast. */
  | 'bye'
  /** A single shared-state key change. */
  | 'patch'
  /** A navigation instruction aimed at one surface. */
  | 'nav'
  /** A user-defined command (see `link.send`). */
  | 'cmd'
  /** Liveness probe used only when Web Locks presence is unavailable. */
  | 'ping'
  /** Reply to `ping`. */
  | 'pong'

/**
 * A pluggable message channel between windows.
 *
 * The bundled implementation is `createBroadcastChannelTransport`, which needs
 * no server. Implement this interface to route dualscreen traffic over
 * anything else — a WebSocket, a Service Worker, a test double.
 */
export interface Transport {
  /** Human-readable name, surfaced in devtools. */
  readonly name: string
  /** Deliver an envelope to every other peer on the channel. */
  send(envelope: Envelope): void
  /**
   * Register a receiver. Implementations MUST NOT echo a peer's own messages
   * back to it. Returns an unsubscribe function.
   */
  subscribe(handler: (envelope: Envelope) => void): () => void
  /** Tear down underlying resources. Safe to call more than once. */
  close(): void
}

/** Identity and metadata for one participating window. */
export interface PeerInfo {
  /** Stable, unique id for this window. Regenerated on reload. */
  id: string
  /**
   * Which surface this window renders. `'main'` is the primary window; any
   * other value is the name of a secondary surface (e.g. `'inspector'`).
   */
  role: string
  /** Wall-clock ms at which this peer joined, per its own clock. */
  joinedAt: number
  /** Whether this peer currently holds the leader lock. */
  leader: boolean
  /** Arbitrary app-supplied metadata, included in presence broadcasts. */
  meta?: Record<string, unknown>
}

/**
 * One entry in the shared-state map.
 *
 * Conflicts resolve last-writer-wins on `(version, origin)`: the higher
 * `version` wins, and an equal `version` is broken by the lexicographically
 * larger `origin`. That tiebreak is arbitrary but *identical on every peer*,
 * which is what makes the map converge without a server.
 */
export interface StateEntry<T = unknown> {
  /** The current value. */
  value: T
  /** Monotonic version counter. */
  version: number
  /** Peer id of the writer that produced this version. */
  origin: string
  /**
   * Ephemeral entries are excluded from snapshots and never replayed to a
   * late-joining window. Use for cursors, hover, scrub position.
   */
  ephemeral?: boolean
}

/** The full shared-state map, keyed by state key. */
export type StateMap = Record<string, StateEntry>

/** Payload of a `hello` message. */
export interface HelloPayload {
  peer: PeerInfo
}

/** Payload of a `welcome` message — the snapshot handed to a late joiner. */
export interface WelcomePayload {
  /** Non-ephemeral state entries only. */
  state: StateMap
  /** Every peer the leader currently knows about. */
  peers: PeerInfo[]
}

/** Payload of a `patch` message. */
export interface PatchPayload {
  key: string
  entry: StateEntry
}

/** Payload of a `nav` message. */
export interface NavPayload {
  /** Name of the surface being navigated. */
  surface: string
  /** Destination — an app-defined route string. */
  to: string
  /** Replace the history entry instead of pushing a new one. */
  replace?: boolean
}

/** Payload of a `cmd` message. */
export interface CmdPayload {
  name: string
  args: unknown
}

/** Options accepted by `createLink`. */
export interface LinkOptions {
  /**
   * Namespace for this app. Windows only talk to windows on the same channel,
   * so distinct apps on one origin never collide. Required.
   */
  channel: string
  /**
   * Which surface this window renders. Defaults to the value read from the
   * URL (`?ds=<name>`), falling back to `'main'`.
   */
  role?: string
  /** Transport to use. Defaults to BroadcastChannel. */
  transport?: Transport
  /** Arbitrary metadata advertised to other peers in presence messages. */
  meta?: Record<string, unknown>
  /**
   * Initial values applied only if no other peer already holds the key.
   * Lets every window declare the same defaults without fighting.
   */
  initialState?: Record<string, unknown>
  /**
   * Milliseconds a late joiner waits for a `welcome` before assuming it is
   * alone and promoting its own state. Default `250`.
   */
  snapshotTimeout?: number
  /** Emit protocol tracing to `console.debug`. Default `false`. */
  debug?: boolean
}

/** Events emitted by a `Link`. */
export type LinkEvents = {
  /** The set of connected peers changed. */
  peers: (peers: PeerInfo[]) => void
  /** This window gained or lost the leader role. */
  leader: (isLeader: boolean) => void
  /** Any shared-state key changed, from any peer including this one. */
  state: (state: Record<string, unknown>, changedKeys: string[]) => void
  /** A surface was told to navigate. */
  nav: (payload: NavPayload) => void
  /** The link finished its join handshake and holds current state. */
  ready: () => void
}
