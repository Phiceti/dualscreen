import type { Envelope, Transport } from '../types.js'

/** True when the runtime exposes a usable `BroadcastChannel`. */
export function isBroadcastChannelSupported(): boolean {
  return typeof globalThis.BroadcastChannel === 'function'
}

/**
 * The default transport: same-origin, same-browser, zero infrastructure.
 *
 * `BroadcastChannel` delivers to every other context on the origin — tabs,
 * windows, workers, iframes — and, per spec, never echoes a message back to
 * the sender. Latency is sub-millisecond because nothing leaves the process,
 * and payloads are structured-cloned, so anything `postMessage` accepts works.
 *
 * It does not cross devices, browsers, or profiles. If you need that, supply a
 * different {@link Transport}.
 */
export function createBroadcastChannelTransport(channel: string): Transport {
  if (!isBroadcastChannelSupported()) {
    throw new Error(
      '[dualscreen] BroadcastChannel is unavailable in this runtime. ' +
        'Pass a custom `transport` to createLink(), or use createMemoryTransport() for tests.',
    )
  }

  const name = `dualscreen:${channel}`
  let bc: BroadcastChannel | null = new BroadcastChannel(name)
  const handlers = new Set<(e: Envelope) => void>()

  const onMessage = (event: MessageEvent) => {
    const data = event.data as Envelope | undefined
    // Ignore anything that is not ours — other libraries may share the origin.
    if (!data || typeof data !== 'object' || typeof data.t !== 'string') return
    for (const handler of [...handlers]) handler(data)
  }

  bc.addEventListener('message', onMessage)

  return {
    name: 'broadcast-channel',
    send(envelope) {
      if (!bc) return
      try {
        bc.postMessage(envelope)
      } catch (err) {
        // Structured clone failure is the overwhelmingly common cause: a
        // function, DOM node, or class instance ended up in shared state.
        console.error(
          `[dualscreen] failed to post "${envelope.t}" — payload is not structured-cloneable. ` +
            'Shared state must be plain JSON-like data; send an id and re-fetch instead.',
          err,
        )
      }
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    close() {
      if (!bc) return
      bc.removeEventListener('message', onMessage)
      bc.close()
      bc = null
      handlers.clear()
    },
  }
}
