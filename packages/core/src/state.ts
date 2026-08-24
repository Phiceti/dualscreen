import type { StateEntry, StateMap } from './types.js'

/**
 * The shared key/value map replicated across every window on a channel.
 *
 * There is no server to order writes, so ordering has to be derivable
 * identically on every peer from the message alone. Each entry carries
 * `(version, origin)`: a write bumps `version` past the highest the writer has
 * seen for that key, and ties — two windows writing the same key in the same
 * instant — break on the lexicographically larger `origin` peer id. The
 * tiebreak is arbitrary; the point is that it is *the same arbitrary answer
 * everywhere*, so the map converges no matter what order messages arrive in.
 *
 * This is last-writer-wins per key, and it is the right fit for the shape
 * dualscreen targets: one window drives, others follow. It is deliberately not
 * a CRDT. If two windows must edit the same structure concurrently and both
 * edits have to survive, reach for a CRDT library and put dualscreen
 * underneath it as the transport.
 */

/**
 * Keys that must never reach a plain object as a property name.
 *
 * `obj['__proto__'] = value` invokes the prototype setter rather than creating
 * a property, so a peer that writes this key can replace the prototype of the
 * object `getAll()` hands back — and because the key is not an own property,
 * `Object.keys()` shows nothing and the value is invisible to both the
 * developer and the devtools panel. `constructor` and `prototype` are blocked
 * for the same family of reasons.
 *
 * Every window on an origin can join a channel, so this is reachable by any
 * script on the page — an injected analytics tag, a compromised dependency —
 * not only by code you wrote.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Longest accepted state key. Bounds memory and keeps devtools readable. */
const MAX_KEY_LENGTH = 512

/**
 * Whether `key` is safe to use as a shared-state key.
 *
 * Exported so the same rule can be applied at other boundaries and asserted in
 * tests, rather than duplicated.
 */
export function isSafeStateKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY_LENGTH && !UNSAFE_KEYS.has(key)
}

/**
 * Assign onto a plain object without ever triggering a setter on the
 * prototype chain. Defence in depth behind {@link isSafeStateKey}.
 */
function safeAssign(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
}

/** Options for a single write. */
export interface SetOptions {
  /**
   * Exclude from snapshots so a late-joining window never replays it.
   * Correct for anything that describes *right now* — cursor position, hover
   * target, scrub head — where a stale replay would be wrong, not merely old.
   */
  ephemeral?: boolean
}

export type StateListener = (state: Record<string, unknown>, changedKeys: string[]) => void

export interface StateStore {
  /** Current value for `key`, or `undefined`. */
  get<T = unknown>(key: string): T | undefined
  /** Plain snapshot of every key's value. */
  getAll(): Record<string, unknown>
  /**
   * Write locally and return the entry to broadcast, or `undefined` when the
   * value was unchanged and no message is warranted.
   */
  set(key: string, value: unknown, options?: SetOptions): StateEntry | undefined
  /**
   * Merge a remote entry. Returns `true` if it won and local state changed.
   */
  applyPatch(key: string, entry: StateEntry): boolean
  /** Non-ephemeral entries, for handing to a late joiner. */
  snapshot(): StateMap
  /** Merge a received snapshot. Returns the keys that changed. */
  hydrate(map: StateMap): string[]
  /**
   * Seed defaults. Unlike `set`, this yields to any existing value, so every
   * window can declare identical defaults without racing each other.
   */
  seed(defaults: Record<string, unknown>): StateMap
  /** Subscribe to all changes. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void
  /** Subscribe to one key. Fires only when that key's value changes. */
  subscribeKey<T = unknown>(key: string, listener: (value: T | undefined) => void): () => void
}

export function createStateStore(selfId: string): StateStore {
  const entries = new Map<string, StateEntry>()
  const listeners = new Set<StateListener>()
  const keyListeners = new Map<string, Set<(value: unknown) => void>>()

  const values = () => {
    const out: Record<string, unknown> = {}
    for (const [k, e] of entries) safeAssign(out, k, e.value)
    return out
  }

  const emit = (changed: string[]) => {
    if (changed.length === 0) return
    const all = values()
    for (const listener of [...listeners]) {
      try {
        listener(all, changed)
      } catch (err) {
        console.error('[dualscreen] state listener threw:', err)
      }
    }
    for (const key of changed) {
      const set = keyListeners.get(key)
      if (!set) continue
      const value = entries.get(key)?.value
      for (const listener of [...set]) {
        try {
          listener(value)
        } catch (err) {
          console.error(`[dualscreen] listener for "${key}" threw:`, err)
        }
      }
    }
  }

  /**
   * Is this a well-formed entry from the wire?
   *
   * The payload is cast from `unknown` at the transport boundary, so nothing
   * has checked its shape. A missing `version` would make every comparison
   * `NaN` and silently corrupt convergence, which is far harder to notice than
   * a dropped message.
   */
  const isValidEntry = (entry: unknown): entry is StateEntry => {
    if (!entry || typeof entry !== 'object') return false
    const candidate = entry as Partial<StateEntry>
    return (
      typeof candidate.version === 'number' &&
      Number.isFinite(candidate.version) &&
      typeof candidate.origin === 'string' &&
      'value' in candidate
    )
  }

  /** Does `incoming` beat `current` under the (version, origin) rule? */
  const wins = (incoming: StateEntry, current: StateEntry | undefined): boolean => {
    if (!current) return true
    if (incoming.version !== current.version) return incoming.version > current.version
    if (incoming.origin === current.origin) return true // same writer, later message
    return incoming.origin > current.origin
  }

  return {
    get<T>(key: string) {
      return entries.get(key)?.value as T | undefined
    },
    getAll: values,
    set(key, value, options) {
      if (!isSafeStateKey(key)) {
        console.error(`[dualscreen] refusing to write unsafe state key ${JSON.stringify(key)}.`)
        return undefined
      }
      const current = entries.get(key)
      if (current && Object.is(current.value, value) && current.origin === selfId) return undefined
      const entry: StateEntry = {
        value,
        version: (current?.version ?? 0) + 1,
        origin: selfId,
        ...(options?.ephemeral ? { ephemeral: true } : {}),
      }
      entries.set(key, entry)
      emit([key])
      return entry
    },
    applyPatch(key, entry) {
      // A remote peer produced this key. Any script on the origin can be a
      // peer, so it is untrusted input and gets the same check as a local write.
      if (!isSafeStateKey(key) || !isValidEntry(entry)) {
        console.error(`[dualscreen] dropped malformed patch for key ${JSON.stringify(key)}.`)
        return false
      }
      const current = entries.get(key)
      if (!wins(entry, current)) return false
      if (current && Object.is(current.value, entry.value) && current.version === entry.version) return false
      entries.set(key, entry)
      emit([key])
      return true
    },
    snapshot() {
      const out: StateMap = {}
      for (const [k, e] of entries) {
        if (!e.ephemeral) safeAssign(out as Record<string, unknown>, k, e)
      }
      return out
    },
    hydrate(map) {
      const changed: string[] = []
      if (!map || typeof map !== 'object') return changed
      for (const [key, entry] of Object.entries(map)) {
        // A snapshot arrives from whichever peer holds leadership, which is no
        // more trustworthy than any other peer.
        if (!isSafeStateKey(key) || !isValidEntry(entry)) continue
        const current = entries.get(key)
        if (!wins(entry, current)) continue
        entries.set(key, entry)
        changed.push(key)
      }
      emit(changed)
      return changed
    },
    seed(defaults) {
      const created: StateMap = {}
      const changed: string[] = []
      for (const [key, value] of Object.entries(defaults)) {
        if (!isSafeStateKey(key)) {
          console.error(`[dualscreen] refusing to seed unsafe state key ${JSON.stringify(key)}.`)
          continue
        }
        if (entries.has(key)) continue // an existing value always wins over a default
        const entry: StateEntry = { value, version: 1, origin: selfId }
        entries.set(key, entry)
        safeAssign(created as Record<string, unknown>, key, entry)
        changed.push(key)
      }
      emit(changed)
      return created
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeKey<T>(key: string, listener: (value: T | undefined) => void) {
      let set = keyListeners.get(key)
      if (!set) {
        set = new Set()
        keyListeners.set(key, set)
      }
      const fn = listener as (value: unknown) => void
      set.add(fn)
      return () => {
        set.delete(fn)
        if (set.size === 0) keyListeners.delete(key)
      }
    },
  }
}
