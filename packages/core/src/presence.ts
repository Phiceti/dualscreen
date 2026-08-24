import type { PeerInfo } from './types.js'
import { isWebLocksSupported } from './leader.js'

/**
 * Who else is on this channel right now.
 *
 * Clean exits are easy: a window broadcasts `bye` on `pagehide`. Unclean exits
 * are the hard part — a crashed tab, a force-quit browser, a laptop lid closed
 * mid-render. Those never fire an unload handler, so a naive registry
 * accumulates ghosts forever.
 *
 * Where Web Locks exists we solve that exactly rather than approximately: each
 * window holds a lock named after its own peer id for its whole lifetime, and
 * `navigator.locks.query()` reports which of those locks are still held. Any
 * peer in our registry without a live lock is definitively gone. No heartbeat,
 * no timeout, no guessing.
 *
 * Without Web Locks we fall back to last-seen timestamps refreshed by periodic
 * pings, which is the usual approximation and inherits the usual tradeoff:
 * prune too eagerly and you drop a busy window, too lazily and ghosts linger.
 */

export interface PresenceOptions {
  /** Channel namespace, used to build lock names. */
  channel: string
  /** This window's own peer record. */
  self: PeerInfo
  /** Called whenever the peer list changes. */
  onChange: (peers: PeerInfo[]) => void
  /** Fallback-only: ms without contact before a peer is considered gone. */
  staleMs?: number
}

export interface Presence {
  /** Every known live peer, including this window. Sorted by join time. */
  readonly peers: PeerInfo[]
  /** Peer ids only — the shape leader election wants. */
  readonly peerIds: string[]
  /** Record or refresh a peer. */
  upsert(peer: PeerInfo): void
  /** Merge a batch (used when a snapshot arrives). */
  merge(peers: PeerInfo[]): void
  /** Forget a peer that announced a clean exit. */
  remove(peerId: string): void
  /** Note that we heard from a peer, refreshing its staleness clock. */
  touch(peerId: string): void
  /** Update this window's own record — e.g. after winning leadership. */
  updateSelf(patch: Partial<PeerInfo>): void
  /** Prune peers that are no longer alive. Safe to call often. */
  sweep(): Promise<void>
  /** Release this window's presence lock. */
  dispose(): void
}

export function createPresence(options: PresenceOptions): Presence {
  const { channel, onChange, staleMs = 6000 } = options
  const lockPrefix = `dualscreen:${channel}:peer:`
  const peers = new Map<string, PeerInfo>()
  const lastSeen = new Map<string, number>()
  let self = options.self
  let disposed = false
  let releaseSelfLock: (() => void) | undefined

  peers.set(self.id, self)
  lastSeen.set(self.id, Date.now())

  // Hold a lock named for ourselves so other windows can prove we are alive.
  if (isWebLocksSupported()) {
    void navigator.locks
      .request(lockPrefix + self.id, { mode: 'exclusive' }, () => {
        if (disposed) return Promise.resolve()
        return new Promise<void>((resolve) => {
          releaseSelfLock = resolve
        })
      })
      .catch(() => {
        /* presence degrades to last-seen; not fatal */
      })
  }

  const snapshot = () => [...peers.values()].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))

  let notifyQueued = false
  const notify = () => {
    // Coalesce bursts (a snapshot merge touches many peers at once) into one
    // callback, so subscribers re-render once rather than N times.
    if (notifyQueued) return
    notifyQueued = true
    queueMicrotask(() => {
      notifyQueued = false
      if (!disposed) onChange(snapshot())
    })
  }

  return {
    get peers() {
      return snapshot()
    },
    get peerIds() {
      return snapshot().map((p) => p.id)
    },
    upsert(peer) {
      const existing = peers.get(peer.id)
      lastSeen.set(peer.id, Date.now())
      if (existing && existing.role === peer.role && existing.leader === peer.leader) return
      peers.set(peer.id, peer)
      notify()
    },
    merge(incoming) {
      let changed = false
      for (const peer of incoming) {
        if (peer.id === self.id) continue
        const existing = peers.get(peer.id)
        lastSeen.set(peer.id, Date.now())
        if (!existing || existing.role !== peer.role || existing.leader !== peer.leader) {
          peers.set(peer.id, peer)
          changed = true
        }
      }
      if (changed) notify()
    },
    remove(peerId) {
      if (peerId === self.id) return
      if (peers.delete(peerId)) {
        lastSeen.delete(peerId)
        notify()
      }
    },
    touch(peerId) {
      lastSeen.set(peerId, Date.now())
    },
    updateSelf(patch) {
      self = { ...self, ...patch }
      peers.set(self.id, self)
      notify()
    },
    async sweep() {
      if (disposed) return
      let changed = false

      if (isWebLocksSupported()) {
        try {
          const state = await navigator.locks.query()
          const alive = new Set<string>()
          for (const lock of state.held ?? []) {
            if (lock.name?.startsWith(lockPrefix)) alive.add(lock.name.slice(lockPrefix.length))
          }
          // An empty result means the query itself is unreliable, not that
          // every peer died — never prune on it.
          if (alive.size > 0) {
            for (const id of [...peers.keys()]) {
              if (id !== self.id && !alive.has(id)) {
                peers.delete(id)
                lastSeen.delete(id)
                changed = true
              }
            }
          }
        } catch {
          /* fall through to the timestamp sweep */
        }
      } else {
        const cutoff = Date.now() - staleMs
        for (const [id, seen] of lastSeen) {
          if (id !== self.id && seen < cutoff) {
            peers.delete(id)
            lastSeen.delete(id)
            changed = true
          }
        }
      }

      if (changed) notify()
    },
    dispose() {
      disposed = true
      releaseSelfLock?.()
      releaseSelfLock = undefined
      peers.clear()
      lastSeen.clear()
    },
  }
}
