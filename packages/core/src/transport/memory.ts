import type { Envelope, Transport } from '../types.js'

/** In-process hubs, keyed by channel name. */
const hubs = new Map<string, Set<(e: Envelope) => void>>()

/**
 * An in-process transport that mimics BroadcastChannel semantics, including
 * the no-self-echo rule.
 *
 * Two uses: driving deterministic tests without a browser, and running the
 * split-pane fallback where both surfaces live in one window and there is no
 * real cross-window boundary to cross.
 */
export function createMemoryTransport(channel: string): Transport {
  let hub = hubs.get(channel)
  if (!hub) {
    hub = new Set()
    hubs.set(channel, hub)
  }
  const localHandlers = new Set<(e: Envelope) => void>()
  let closed = false

  const receive = (envelope: Envelope) => {
    if (closed) return
    for (const handler of [...localHandlers]) handler(envelope)
  }
  hub.add(receive)

  return {
    name: 'memory',
    send(envelope) {
      if (closed) return
      // Clone so receivers cannot mutate the sender's objects — this is what a
      // real transport's structured clone would do for us.
      const copy = structuredClone(envelope)
      for (const peer of [...hub]) {
        if (peer === receive) continue // never echo to self
        peer(copy)
      }
    },
    subscribe(handler) {
      localHandlers.add(handler)
      return () => {
        localHandlers.delete(handler)
      }
    },
    close() {
      closed = true
      hub.delete(receive)
      localHandlers.clear()
      if (hub.size === 0) hubs.delete(channel)
    },
  }
}

/** Drop every in-memory hub. Call between tests to guarantee isolation. */
export function resetMemoryTransports(): void {
  hubs.clear()
}
