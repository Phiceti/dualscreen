/**
 * Generate a short, collision-resistant id.
 * Uses `crypto.randomUUID` where available and falls back to a random string.
 */
export function uid(prefix = ''): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return prefix + c.randomUUID().slice(0, 8)
  return prefix + Math.random().toString(36).slice(2, 10)
}

/** Minimal typed event emitter. No dependencies, no inheritance. */
export class Emitter<Events extends Record<string, (...args: never[]) => void>> {
  #handlers = new Map<keyof Events, Set<(...args: never[]) => void>>()

  /** Subscribe to `event`. Returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: Events[K]): () => void {
    let set = this.#handlers.get(event)
    if (!set) {
      set = new Set()
      this.#handlers.set(event, set)
    }
    set.add(handler)
    return () => {
      set.delete(handler)
    }
  }

  /** Subscribe to `event` for exactly one emission. */
  once<K extends keyof Events>(event: K, handler: Events[K]): () => void {
    const off = this.on(event, ((...args: never[]) => {
      off()
      ;(handler as (...a: never[]) => void)(...args)
    }) as Events[K])
    return off
  }

  /** Invoke every handler for `event`. Handler errors are isolated. */
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this.#handlers.get(event)
    if (!set) return
    for (const handler of [...set]) {
      try {
        ;(handler as (...a: unknown[]) => void)(...args)
      } catch (err) {
        console.error(`[dualscreen] handler for "${String(event)}" threw:`, err)
      }
    }
  }

  /** Drop every handler. */
  clear(): void {
    this.#handlers.clear()
  }
}

/**
 * Coalesce rapid calls onto animation frames, keeping only the newest value.
 *
 * This is what keeps 60fps pointer streams from flooding the transport: a burst
 * of N calls within one frame produces exactly one send, carrying the last
 * value. Falls back to `setTimeout` where `requestAnimationFrame` is absent
 * (Node, workers, background tabs).
 */
export function rafThrottle<T>(fn: (value: T) => void): ((value: T) => void) & { cancel(): void } {
  let scheduled = false
  let latest: T
  let handle: number | undefined
  const raf: (cb: () => void) => number =
    typeof requestAnimationFrame === 'function'
      ? (cb) => requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number
  const cancelRaf: (h: number) => void =
    typeof cancelAnimationFrame === 'function'
      ? (h) => cancelAnimationFrame(h)
      : (h) => clearTimeout(h as unknown as ReturnType<typeof setTimeout>)

  const wrapped = (value: T) => {
    latest = value
    if (scheduled) return
    scheduled = true
    handle = raf(() => {
      scheduled = false
      handle = undefined
      fn(latest)
    })
  }
  wrapped.cancel = () => {
    if (handle !== undefined) cancelRaf(handle)
    scheduled = false
    handle = undefined
  }
  return wrapped
}

/** Trailing-edge throttle on a fixed millisecond interval. */
export function throttle<T>(fn: (value: T) => void, ms: number): ((value: T) => void) & { cancel(): void } {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest: T

  const wrapped = (value: T) => {
    latest = value
    const now = Date.now()
    const wait = ms - (now - last)
    if (wait <= 0) {
      last = now
      fn(latest)
    } else if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        last = Date.now()
        fn(latest)
      }, wait)
    }
  }
  wrapped.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return wrapped
}

/** Structural equality good enough for state diffing. Cheap on primitives. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}
