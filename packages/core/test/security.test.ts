import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLink, type Link } from '../src/link.js'
import { createMemoryTransport, resetMemoryTransports } from '../src/transport/memory.js'
import { isSafeStateKey } from '../src/state.js'
import { isSafeRoute, isValidSurfaceName, readSurface, surfaceUrl } from '../src/surface.js'
import type { Envelope, MessageType } from '../src/types.js'

/**
 * Security regressions.
 *
 * The threat model these guard: `BroadcastChannel` is scoped to an origin, not
 * to your application, so *any* script running on the page can join a channel
 * and send whatever it likes. That includes injected analytics tags and
 * compromised dependencies, not just code you wrote. Everything arriving from
 * the transport is therefore untrusted input.
 */

const open: Link[] = []
const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms))

function link(channel: string, role = 'main'): Link {
  const l = createLink({ channel, role, transport: createMemoryTransport(channel), snapshotTimeout: 20 })
  open.push(l)
  return l
}

/** A raw hostile message, built without going through the public API. */
function hostile(type: MessageType, payload: unknown): Envelope {
  return { p: 1, id: `evil-${Math.random()}`, from: 'attacker-0000', to: '*', t: type, c: 999, d: payload }
}

afterEach(() => {
  for (const l of open.splice(0)) l.close()
  resetMemoryTransports()
  vi.restoreAllMocks()
})

describe('prototype pollution', () => {
  it('refuses to write __proto__ through the public API', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = link('sec1')
    await a.whenReady()

    a.set('__proto__', { isAdmin: true })
    await settle()

    const state = a.getAll()
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype)
    expect((state as Record<string, unknown>).isAdmin).toBeUndefined()
    expect(error).toHaveBeenCalled()
  })

  it('rejects a hand-crafted __proto__ patch from the wire', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const victim = link('sec2')
    await victim.whenReady()

    // The realistic attack skips `set()` entirely and speaks the protocol.
    const attacker = createMemoryTransport('sec2')
    attacker.send(hostile('patch', { key: '__proto__', entry: { value: { isAdmin: true }, version: 999, origin: 'z' } }))
    await settle()

    const state = victim.getAll()
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype)
    expect((state as Record<string, unknown>).isAdmin).toBeUndefined()
    attacker.close()
  })

  it('rejects constructor and prototype as keys', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const victim = link('sec3')
    await victim.whenReady()

    const attacker = createMemoryTransport('sec3')
    for (const key of ['constructor', 'prototype']) {
      attacker.send(hostile('patch', { key, entry: { value: { pwned: true }, version: 999, origin: 'z' } }))
    }
    await settle()

    expect(Object.keys(victim.getAll())).toHaveLength(0)
    attacker.close()
  })

  it('leaves the global Object.prototype untouched regardless', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const victim = link('sec4')
    await victim.whenReady()
    const attacker = createMemoryTransport('sec4')
    attacker.send(hostile('patch', { key: '__proto__', entry: { value: { leaked: 1 }, version: 9, origin: 'z' } }))
    await settle()

    expect(({} as Record<string, unknown>).leaked).toBeUndefined()
    attacker.close()
  })
})

describe('malformed messages', () => {
  it('survives every malformed payload without breaking the link', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const victim = link('sec5')
    await victim.whenReady()

    const attacker = createMemoryTransport('sec5')
    const garbage: Array<[MessageType, unknown]> = [
      ['hello', null],
      ['hello', { peer: { id: 123 } }],
      ['hello', { peer: { id: 'x', role: 'y' } }], // no joinedAt
      ['welcome', { peers: 'not-an-array', state: 'not-an-object' }],
      ['welcome', null],
      ['patch', { key: 'ok', entry: { value: 1 } }], // no version
      ['patch', { key: 42, entry: { value: 1, version: 1, origin: 'z' } }],
      ['patch', null],
      ['cmd', { name: null }],
      ['cmd', { name: 'x'.repeat(500) }],
      ['nav', { surface: 42, to: '/x' }],
      ['nav', null],
    ]
    for (const [type, payload] of garbage) attacker.send(hostile(type, payload))
    await settle()

    // Still alive, still holding no junk, still usable.
    expect(victim.isReady).toBe(true)
    expect(Object.keys(victim.getAll())).toHaveLength(0)
    victim.set('gene', 'TP53')
    await settle()
    expect(victim.get('gene')).toBe('TP53')
    attacker.close()
  })

  it('ignores peers speaking a different protocol version', async () => {
    const victim = link('sec6')
    await victim.whenReady()
    const attacker = createMemoryTransport('sec6')
    attacker.send({ ...hostile('patch', { key: 'x', entry: { value: 1, version: 9, origin: 'z' } }), p: 99 as 1 })
    await settle()
    expect(victim.get('x')).toBeUndefined()
    attacker.close()
  })

  it('caps how many peers one snapshot can add', async () => {
    const victim = link('sec7')
    await victim.whenReady()

    const attacker = createMemoryTransport('sec7')
    const peers = Array.from({ length: 500 }, (_, i) => ({
      id: `flood-${i}`,
      role: 'main',
      joinedAt: Date.now(),
      leader: false,
    }))
    attacker.send(hostile('welcome', { peers, state: {} }))
    await settle()

    // 64 injected + this window.
    expect(victim.peers.length).toBeLessThanOrEqual(65)
    attacker.close()
  })
})

describe('surface names', () => {
  it('accepts ordinary names and rejects hostile ones', () => {
    for (const good of ['main', 'inspector', 'my-surface', 'panel_2', 'A1']) {
      expect(isValidSurfaceName(good)).toBe(true)
    }
    for (const bad of ['', 'a'.repeat(65), 'ds:route:x', '../../etc', '<script>', 'a b', null, 42, {}]) {
      expect(isValidSurfaceName(bad)).toBe(false)
    }
  })

  it('falls back to the main surface for a hostile ?ds= value', () => {
    // A crafted link must degrade to the normal app, not render a blank window.
    expect(readSurface('https://app.test/?ds=ds:route:evil')).toBe('main')
    expect(readSurface('https://app.test/?ds=' + encodeURIComponent('../../x'))).toBe('main')
    expect(readSurface('https://app.test/?ds=' + 'a'.repeat(200))).toBe('main')
    expect(readSurface('https://app.test/?ds=inspector')).toBe('inspector')
  })

  it('refuses to build a URL for an invalid surface name', () => {
    expect(() => surfaceUrl('ds:route:evil', { base: 'https://app.test/' })).toThrow(/invalid surface name/)
  })

  it('rejects an invalid role at construction', () => {
    expect(() => createLink({ channel: 'sec8', role: 'a b c' })).toThrow(/invalid role/)
    expect(() => createLink({ channel: '', role: 'main' })).toThrow(/channel/)
    expect(() => createLink({ channel: 'x'.repeat(200), role: 'main' })).toThrow(/channel/)
  })
})

describe('route safety', () => {
  it('accepts ordinary application routes', () => {
    for (const good of ['/', '/experiment/EXP-102', '/a?b=c#d', 'detail/1', '', '/gene/TP53?tab=volcano']) {
      expect(isSafeRoute(good)).toBe(true)
    }
  })

  it('rejects schemes that execute rather than navigate', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0000javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
    ]) {
      expect(isSafeRoute(bad)).toBe(false)
    }
  })

  it('rejects non-strings and absurd lengths', () => {
    expect(isSafeRoute(null)).toBe(false)
    expect(isSafeRoute(42)).toBe(false)
    expect(isSafeRoute('/'.repeat(3000))).toBe(false)
  })
})

describe('state key rule', () => {
  it('blocks exactly the dangerous keys', () => {
    expect(isSafeStateKey('gene')).toBe(true)
    expect(isSafeStateKey('ds:route:inspector')).toBe(true)
    expect(isSafeStateKey('__proto__')).toBe(false)
    expect(isSafeStateKey('constructor')).toBe(false)
    expect(isSafeStateKey('prototype')).toBe(false)
    expect(isSafeStateKey('')).toBe(false)
    expect(isSafeStateKey('x'.repeat(513))).toBe(false)
    expect(isSafeStateKey(42)).toBe(false)
  })
})
