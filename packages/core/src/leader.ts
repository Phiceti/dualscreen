/**
 * Leader election across windows.
 *
 * One window is designated leader. Its only privilege is answering `hello`
 * with a state snapshot, which keeps late joiners from getting N conflicting
 * replies. Nothing else in the protocol requires a leader, so a brief gap
 * between one leader dying and the next being elected is harmless.
 *
 * The primary mechanism is the Web Locks API. A window requests an exclusive
 * lock and holds it for its entire lifetime; whoever holds it is leader. This
 * is the right primitive because the browser releases the lock the instant the
 * holder goes away — including a crash or a force-quit, where no `unload`
 * handler would ever run. Election is immediate and needs no heartbeat, no
 * timeout, and no tunable that is wrong on someone's machine.
 *
 * Where Web Locks is missing we fall back to "the first peer in the presence
 * list leads". Presence orders peers by join time, so the oldest surviving
 * window leads and leadership does not flap every time a window joins. Every
 * peer derives the same answer from the same list, so it is deterministic —
 * but only as accurate as presence itself is.
 */

/** True when the runtime exposes the Web Locks API. */
export function isWebLocksSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.locks && typeof navigator.locks.request === 'function'
}

export interface LeaderElection {
  /** Whether this window currently holds leadership. */
  readonly isLeader: boolean
  /** Which mechanism decided it. Surfaced in devtools. */
  readonly strategy: 'web-locks' | 'peer-id'
  /**
   * Feed the current peer-id list in, **in priority order** — presence emits
   * peers sorted oldest-first, and the fallback strategy elects `peerIds[0]`.
   * Ignored under Web Locks.
   */
  updatePeers(peerIds: string[]): void
  /** Resign and release the lock. */
  release(): void
}

export interface LeaderElectionOptions {
  /** Lock name — must be identical across the windows competing. */
  name: string
  /** This window's peer id, used by the fallback strategy. */
  peerId: string
  /** Called whenever leadership is gained or lost. */
  onChange: (isLeader: boolean) => void
}

export function createLeaderElection(options: LeaderElectionOptions): LeaderElection {
  const { name, peerId, onChange } = options
  let isLeader = false
  let released = false
  let releaseLock: (() => void) | undefined
  let peerIds: string[] = [peerId]

  const strategy: 'web-locks' | 'peer-id' = isWebLocksSupported() ? 'web-locks' : 'peer-id'

  const setLeader = (next: boolean) => {
    if (next === isLeader) return
    isLeader = next
    onChange(isLeader)
  }

  if (strategy === 'web-locks') {
    // The request queues until the current holder releases. When our callback
    // finally runs we are leader, and we stay leader until the returned
    // promise settles — which we control via `releaseLock`.
    void navigator.locks
      .request(name, { mode: 'exclusive' }, () => {
        if (released) return Promise.resolve()
        setLeader(true)
        return new Promise<void>((resolve) => {
          releaseLock = resolve
        })
      })
      .catch(() => {
        // A rejected lock request (aborted, or an unsupported edge case) must
        // not leave the app leaderless forever — degrade to the peer-id rule.
        if (!released) recomputeByPeerId()
      })
  }

  function recomputeByPeerId() {
    setLeader(peerIds[0] === peerId)
  }

  if (strategy === 'peer-id') recomputeByPeerId()

  return {
    get isLeader() {
      return isLeader
    },
    strategy,
    updatePeers(next) {
      peerIds = next.length > 0 ? next : [peerId]
      if (strategy === 'peer-id') recomputeByPeerId()
    },
    release() {
      if (released) return
      released = true
      setLeader(false)
      releaseLock?.()
      releaseLock = undefined
    },
  }
}
