import type {
  CmdPayload,
  Envelope,
  HelloPayload,
  LinkEvents,
  LinkOptions,
  MessageType,
  NavPayload,
  PatchPayload,
  PeerInfo,
  StateEntry,
  Transport,
  WelcomePayload,
} from './types.js'
import { PROTOCOL_VERSION } from './types.js'
import { Emitter, uid } from './util.js'
import { createBroadcastChannelTransport, isBroadcastChannelSupported } from './transport/broadcast-channel.js'
import { createMemoryTransport } from './transport/memory.js'
import { createLeaderElection } from './leader.js'
import { createPresence } from './presence.js'
import { createStateStore, type SetOptions, type StateListener } from './state.js'
import { isValidSurfaceName, MAIN_SURFACE, readSurface } from './surface.js'

/** How often to prune dead peers, in ms. */
const SWEEP_INTERVAL = 3000
/** Fallback-only liveness ping interval, in ms. */
const PING_INTERVAL = 2000
/**
 * Ceiling on peers accepted from one snapshot.
 *
 * A snapshot arrives from whichever window holds leadership, and any script on
 * the origin can be that window. Bounding the list keeps a hostile or buggy
 * peer from growing the registry without limit.
 */
const MAX_PEERS_PER_SNAPSHOT = 64
/** Ceiling on a command name, which is app-defined and arrives from the wire. */
const MAX_COMMAND_NAME = 128

/**
 * Is this a well-formed peer record from the wire?
 *
 * Everything crossing the transport is cast from `unknown`, so nothing has
 * checked its shape. A malformed peer would otherwise reach the presence
 * registry and throw from inside a message handler.
 */
function isValidPeer(peer: unknown): peer is PeerInfo {
  if (!peer || typeof peer !== 'object') return false
  const candidate = peer as Partial<PeerInfo>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= 128 &&
    typeof candidate.role === 'string' &&
    candidate.role.length > 0 &&
    candidate.role.length <= 64 &&
    typeof candidate.joinedAt === 'number' &&
    Number.isFinite(candidate.joinedAt)
  )
}

/**
 * A live connection between this window and every other window on the channel.
 *
 * Create one per window. It owns the transport, tracks who else is connected,
 * elects a leader, and replicates shared state.
 */
export interface Link {
  /** This window's peer id. Unique per window; regenerated on reload. */
  readonly id: string
  /** The surface this window renders. `'main'` for the primary window. */
  readonly role: string
  /** The channel namespace. */
  readonly channel: string
  /** Whether this window currently holds leadership. */
  readonly isLeader: boolean
  /**
   * `true` once the join handshake settled and shared state is current.
   * Reads before this may be stale; writes are always safe.
   */
  readonly isReady: boolean
  /** Every connected window, including this one. */
  readonly peers: PeerInfo[]
  /** Peers other than this window. */
  readonly others: PeerInfo[]
  /** Diagnostics for devtools and bug reports. */
  readonly diagnostics: LinkDiagnostics

  /** Read a shared value. */
  get<T = unknown>(key: string): T | undefined
  /** Every shared value as a plain object. */
  getAll(): Record<string, unknown>
  /** Write a shared value and replicate it to every other window. */
  set(key: string, value: unknown, options?: SetOptions): void
  /** Subscribe to every shared-state change. */
  subscribe(listener: StateListener): () => void
  /** Subscribe to one shared key. */
  subscribeKey<T = unknown>(key: string, listener: (value: T | undefined) => void): () => void

  /** Send a user-defined command to other windows. */
  send(name: string, args?: unknown, options?: { to?: string }): void
  /** Handle a user-defined command. Returns an unsubscribe function. */
  command(name: string, handler: (args: never, from: string) => void): () => void

  /** Tell a surface to navigate. Ignored by windows rendering other surfaces. */
  navigate(surface: string, to: string, options?: { replace?: boolean }): void

  /** Subscribe to a lifecycle event. */
  on<K extends keyof LinkEvents>(event: K, handler: LinkEvents[K]): () => void
  /**
   * Observe every envelope entering or leaving this window.
   *
   * Intended for devtools and debugging. Taps run on the hot path, so keep
   * them cheap — and note that a throwing tap is caught and logged rather than
   * allowed to break message delivery.
   */
  tap(handler: TapHandler): () => void
  /** Resolves once the join handshake settles. */
  whenReady(): Promise<void>

  /** Announce departure and release every resource. Idempotent. */
  close(): void
}

/** Direction of a tapped message, relative to this window. */
export type TapDirection = 'in' | 'out'

/** Observer of raw protocol traffic. */
export type TapHandler = (envelope: Envelope, direction: TapDirection) => void

/** Snapshot of how the link is operating — what devtools renders. */
export interface LinkDiagnostics {
  transport: string
  leaderStrategy: 'web-locks' | 'peer-id'
  protocol: number
  clock: number
  sent: number
  received: number
  ready: boolean
}

/**
 * Open a link to every other window on `channel`.
 *
 * ```ts
 * const link = createLink({ channel: 'my-app' })
 * link.set('selectedId', 'EXP-102')
 * link.subscribeKey('selectedId', (id) => render(id))
 * ```
 *
 * With no `transport` supplied this uses BroadcastChannel — same origin, same
 * browser, no server, sub-millisecond delivery.
 */
export function createLink(options: LinkOptions): Link {
  const {
    channel,
    role = readSurface(),
    meta,
    initialState,
    snapshotTimeout = 250,
    debug = false,
  } = options

  if (typeof channel !== 'string' || channel.length === 0 || channel.length > 128) {
    throw new Error('[dualscreen] createLink() requires a `channel` of 1–128 characters.')
  }
  if (!isValidSurfaceName(role)) {
    throw new Error(
      `[dualscreen] invalid role ${JSON.stringify(role)}. ` +
        'Use 1–64 characters from A–Z, a–z, 0–9, hyphen, or underscore.',
    )
  }

  const id = uid(`${role}-`)
  const emitter = new Emitter<LinkEvents>()
  const commands = new Map<string, Set<(args: never, from: string) => void>>()
  const taps = new Set<TapHandler>()
  const state = createStateStore(id)

  let clock = 0
  let sent = 0
  let received = 0
  let ready = false
  let closed = false
  let readyResolve: (() => void) | undefined
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve
  })
  // The handshake races a real reply against a timeout, so a lone window does
  // not hang waiting for a leader that will never answer.
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined
  let sweepTimer: ReturnType<typeof setInterval> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined

  const log = (...args: unknown[]) => {
    if (debug) console.debug(`[dualscreen:${role}:${id.slice(-4)}]`, ...args)
  }

  const transport: Transport =
    options.transport ??
    (isBroadcastChannelSupported() ? createBroadcastChannelTransport(channel) : createMemoryTransport(channel))

  const self: PeerInfo = { id, role, joinedAt: Date.now(), leader: false, ...(meta ? { meta } : {}) }

  const presence = createPresence({
    channel,
    self,
    onChange: (peers) => {
      leader.updatePeers(peers.map((p) => p.id))
      emitter.emit('peers', peers)
    },
  })

  const leader = createLeaderElection({
    name: `dualscreen:${channel}:leader`,
    peerId: id,
    onChange: (isLeader) => {
      log('leadership', isLeader)
      presence.updateSelf({ leader: isLeader })
      emitter.emit('leader', isLeader)
      // Re-announce so peers learn who to ask for snapshots.
      if (!closed) post('hello', { peer: { ...self, leader: isLeader } } satisfies HelloPayload)
    },
  })

  function notifyTaps(envelope: Envelope, direction: TapDirection): void {
    if (taps.size === 0) return
    for (const tap of [...taps]) {
      try {
        tap(envelope, direction)
      } catch (err) {
        console.error('[dualscreen] tap threw:', err)
      }
    }
  }

  function post(type: MessageType, payload: unknown, to: string | '*' = '*'): void {
    if (closed) return
    clock += 1
    sent += 1
    const envelope: Envelope = { p: PROTOCOL_VERSION, id: uid(), from: id, to, t: type, c: clock, d: payload }
    log('→', type, payload)
    notifyTaps(envelope, 'out')
    transport.send(envelope)
  }

  function handle(envelope: Envelope): void {
    if (closed) return
    // Peers speaking a different protocol version are ignored rather than
    // crashed on — a stale tab left open across a deploy must not break a
    // fresh one.
    if (envelope.p !== PROTOCOL_VERSION) return
    if (typeof envelope.from !== 'string' || typeof envelope.t !== 'string') return
    if (typeof envelope.c !== 'number' || !Number.isFinite(envelope.c)) return
    if (envelope.from === id) return
    if (envelope.to !== '*' && envelope.to !== id) return

    received += 1
    clock = Math.max(clock, envelope.c) + 1
    presence.touch(envelope.from)
    log('←', envelope.t, envelope.d)
    notifyTaps(envelope, 'in')

    switch (envelope.t) {
      case 'hello': {
        const { peer } = (envelope.d ?? {}) as HelloPayload
        if (!isValidPeer(peer)) return
        presence.upsert(peer)
        // Only the leader answers, so a late joiner gets exactly one snapshot.
        if (leader.isLeader) {
          post(
            'welcome',
            { state: state.snapshot(), peers: presence.peers } satisfies WelcomePayload,
            envelope.from,
          )
        }
        break
      }
      case 'welcome': {
        const { state: remoteState, peers } = (envelope.d ?? {}) as WelcomePayload
        if (Array.isArray(peers)) {
          presence.merge(peers.filter(isValidPeer).slice(0, MAX_PEERS_PER_SNAPSHOT))
        }
        // `hydrate` validates every key and entry itself.
        if (remoteState && typeof remoteState === 'object') state.hydrate(remoteState)
        settle()
        break
      }
      case 'bye': {
        presence.remove(envelope.from)
        break
      }
      case 'patch': {
        const { key, entry } = (envelope.d ?? {}) as PatchPayload
        // `applyPatch` rejects unsafe keys and malformed entries.
        state.applyPatch(key, entry)
        break
      }
      case 'nav': {
        const payload = (envelope.d ?? {}) as NavPayload
        if (typeof payload.surface !== 'string' || typeof payload.to !== 'string') break
        emitter.emit('nav', payload)
        break
      }
      case 'cmd': {
        const { name, args } = (envelope.d ?? {}) as CmdPayload
        if (typeof name !== 'string' || name.length === 0 || name.length > MAX_COMMAND_NAME) break
        const handlers = commands.get(name)
        if (!handlers) break
        for (const handler of [...handlers]) {
          try {
            handler(args as never, envelope.from)
          } catch (err) {
            console.error(`[dualscreen] command "${name}" threw:`, err)
          }
        }
        break
      }
      case 'ping': {
        post('pong', null, envelope.from)
        break
      }
      case 'pong':
        break
    }
  }

  /**
   * Finish the join handshake: apply defaults, publish anything we created,
   * and unblock `whenReady`. Runs at most once, whichever of the snapshot or
   * the timeout arrives first.
   */
  function settle(): void {
    if (ready || closed) return
    ready = true
    if (snapshotTimer !== undefined) clearTimeout(snapshotTimer)
    snapshotTimer = undefined

    if (initialState) {
      // `seed` yields to any value the snapshot already provided, so every
      // window can declare identical defaults without fighting over them.
      const created = state.seed(initialState)
      for (const [key, entry] of Object.entries(created)) {
        post('patch', { key, entry } satisfies PatchPayload)
      }
    }

    readyResolve?.()
    emitter.emit('ready')
    log('ready')
  }

  /**
   * A throw from `handle` would propagate into the transport's dispatch loop
   * and skip every handler after it. One malformed message must not take the
   * link down, so the boundary is guarded here as well as validated above.
   */
  const safeHandle = (envelope: Envelope): void => {
    try {
      handle(envelope)
    } catch (err) {
      console.error('[dualscreen] dropped a message that could not be handled:', err)
    }
  }

  const unsubscribeTransport = transport.subscribe(safeHandle)

  // Announce ourselves, then wait briefly for a leader to answer with state.
  post('hello', { peer: self } satisfies HelloPayload)
  snapshotTimer = setTimeout(settle, snapshotTimeout)

  sweepTimer = setInterval(() => {
    void presence.sweep()
  }, SWEEP_INTERVAL)
  if (leader.strategy === 'peer-id') {
    // Without Web Locks, presence has no crash signal — keep it fed.
    pingTimer = setInterval(() => post('ping', null), PING_INTERVAL)
  }

  // `pagehide` fires reliably on navigation, tab close, and bfcache entry,
  // where `unload` does not. It is the best clean-exit signal available.
  const onPageHide = () => link.close()
  if (typeof addEventListener === 'function') addEventListener('pagehide', onPageHide)

  const link: Link = {
    id,
    role,
    channel,
    get isLeader() {
      return leader.isLeader
    },
    get isReady() {
      return ready
    },
    get peers() {
      return presence.peers
    },
    get others() {
      return presence.peers.filter((p) => p.id !== id)
    },
    get diagnostics() {
      return {
        transport: transport.name,
        leaderStrategy: leader.strategy,
        protocol: PROTOCOL_VERSION,
        clock,
        sent,
        received,
        ready,
      }
    },

    get: (key) => state.get(key),
    getAll: () => state.getAll(),
    set(key, value, setOptions) {
      const entry: StateEntry | undefined = state.set(key, value, setOptions)
      if (entry) post('patch', { key, entry } satisfies PatchPayload)
    },
    subscribe: (listener) => state.subscribe(listener),
    subscribeKey: (key, listener) => state.subscribeKey(key, listener),

    send(name, args, sendOptions) {
      post('cmd', { name, args } satisfies CmdPayload, sendOptions?.to ?? '*')
    },
    command(name, handler) {
      let set = commands.get(name)
      if (!set) {
        set = new Set()
        commands.set(name, set)
      }
      set.add(handler)
      return () => {
        set.delete(handler)
        if (set.size === 0) commands.delete(name)
      }
    },

    navigate(surface, to, navOptions) {
      post('nav', { surface, to, replace: navOptions?.replace } satisfies NavPayload)
      // A window can drive its own surface; emit locally so the caller does not
      // special-case "am I the target".
      if (surface === role) emitter.emit('nav', { surface, to, replace: navOptions?.replace })
    },

    on: (event, handler) => emitter.on(event, handler),
    tap(handler) {
      taps.add(handler)
      return () => {
        taps.delete(handler)
      }
    },
    whenReady: () => readyPromise,

    close() {
      if (closed) return
      closed = true
      if (typeof removeEventListener === 'function') removeEventListener('pagehide', onPageHide)
      if (snapshotTimer !== undefined) clearTimeout(snapshotTimer)
      if (sweepTimer !== undefined) clearInterval(sweepTimer)
      if (pingTimer !== undefined) clearInterval(pingTimer)
      // Announce before tearing down the transport, or the message never ships.
      closed = false
      post('bye', null)
      closed = true
      unsubscribeTransport()
      transport.close()
      taps.clear()
      presence.dispose()
      leader.release()
      commands.clear()
      emitter.clear()
      readyResolve?.()
      log('closed')
    },
  }

  return link
}

export { MAIN_SURFACE }
