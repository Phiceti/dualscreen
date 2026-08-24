import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLink } from '../src/link.js'
import { createMemoryTransport, resetMemoryTransports } from '../src/transport/memory.js'
import type { Link } from '../src/link.js'

/** Links opened during a test, torn down automatically. */
const open: Link[] = []

function link(channel: string, role: string, extra: Record<string, unknown> = {}): Link {
  const l = createLink({
    channel,
    role,
    transport: createMemoryTransport(channel),
    snapshotTimeout: 20,
    ...extra,
  })
  open.push(l)
  return l
}

/** Let queued microtasks and the transport settle. */
const settle = (ms = 40) => new Promise((r) => setTimeout(r, ms))

afterEach(() => {
  for (const l of open.splice(0)) l.close()
  resetMemoryTransports()
})

describe('state replication', () => {
  it('replicates a write from one window to another', async () => {
    const a = link('t1', 'main')
    const b = link('t1', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    a.set('gene', 'TP53')
    await settle()

    expect(b.get('gene')).toBe('TP53')
  })

  it('replicates in both directions', async () => {
    const a = link('t2', 'main')
    const b = link('t2', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    a.set('x', 1)
    b.set('y', 2)
    await settle()

    expect(b.get('x')).toBe(1)
    expect(a.get('y')).toBe(2)
  })

  it('notifies key subscribers on remote change', async () => {
    const a = link('t3', 'main')
    const b = link('t3', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    const seen = vi.fn()
    b.subscribeKey('gene', seen)

    a.set('gene', 'BRCA1')
    await settle()

    expect(seen).toHaveBeenCalledWith('BRCA1')
  })

  it('converges when two windows write the same key concurrently', async () => {
    const a = link('t4', 'main')
    const b = link('t4', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    // Both write before either has seen the other — the classic split-brain
    // case that last-writer-wins has to resolve identically on both sides.
    a.set('conflict', 'from-a')
    b.set('conflict', 'from-b')
    await settle()

    expect(a.get('conflict')).toBe(b.get('conflict'))
  })
})

describe('late join', () => {
  it('hands a snapshot to a window that opens later', async () => {
    const a = link('t5', 'main')
    await a.whenReady()
    a.set('gene', 'TP53')
    a.set('experiment', 'EXP-102')
    await settle()

    const b = link('t5', 'inspector')
    await b.whenReady()

    expect(b.get('gene')).toBe('TP53')
    expect(b.get('experiment')).toBe('EXP-102')
  })

  it('excludes ephemeral keys from the snapshot', async () => {
    const a = link('t6', 'main')
    await a.whenReady()
    a.set('selection', 'kept')
    a.set('cursor', { x: 10, y: 20 }, { ephemeral: true })
    await settle()

    const b = link('t6', 'inspector')
    await b.whenReady()

    expect(b.get('selection')).toBe('kept')
    // A stale cursor position would be wrong, not merely old — it must not
    // be replayed to a window that just opened.
    expect(b.get('cursor')).toBeUndefined()
  })

  it('still replicates ephemeral keys live', async () => {
    const a = link('t7', 'main')
    const b = link('t7', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    a.set('cursor', { x: 1, y: 2 }, { ephemeral: true })
    await settle()

    expect(b.get('cursor')).toEqual({ x: 1, y: 2 })
  })

  it('becomes ready without peers when it is the only window', async () => {
    const a = link('t8', 'main')
    await expect(a.whenReady()).resolves.toBeUndefined()
    expect(a.isReady).toBe(true)
  })
})

describe('initialState', () => {
  it('seeds defaults when no peer holds the key', async () => {
    const a = link('t9', 'main', { initialState: { zoom: 1 } })
    await a.whenReady()
    expect(a.get('zoom')).toBe(1)
  })

  it('yields to an existing value rather than clobbering it', async () => {
    const a = link('t10', 'main', { initialState: { zoom: 1 } })
    await a.whenReady()
    a.set('zoom', 4)
    await settle()

    // The second window declares the same default; the live value must win.
    const b = link('t10', 'inspector', { initialState: { zoom: 1 } })
    await b.whenReady()
    await settle()

    expect(b.get('zoom')).toBe(4)
    expect(a.get('zoom')).toBe(4)
  })
})

describe('presence', () => {
  it('sees the other window', async () => {
    const a = link('t11', 'main')
    const b = link('t11', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])
    await settle()

    expect(a.peers.map((p) => p.role).sort()).toEqual(['inspector', 'main'])
    expect(a.others).toHaveLength(1)
    expect(a.others[0]?.role).toBe('inspector')
  })

  it('drops a window that closes cleanly', async () => {
    const a = link('t12', 'main')
    const b = link('t12', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])
    await settle()
    expect(a.others).toHaveLength(1)

    b.close()
    await settle()

    expect(a.others).toHaveLength(0)
  })

  it('elects exactly one leader', async () => {
    const a = link('t13', 'main')
    const b = link('t13', 'inspector')
    const c = link('t13', 'preview')
    await Promise.all([a.whenReady(), b.whenReady(), c.whenReady()])
    await settle()

    expect([a, b, c].filter((l) => l.isLeader)).toHaveLength(1)
  })
})

describe('commands', () => {
  it('delivers a broadcast command', async () => {
    const a = link('t14', 'main')
    const b = link('t14', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    const handler = vi.fn()
    b.command('zoom', handler)

    a.send('zoom', { factor: 2 })
    await settle()

    expect(handler).toHaveBeenCalledWith({ factor: 2 }, a.id)
  })

  it('delivers a targeted command to only one peer', async () => {
    const a = link('t15', 'main')
    const b = link('t15', 'inspector')
    const c = link('t15', 'preview')
    await Promise.all([a.whenReady(), b.whenReady(), c.whenReady()])

    const toB = vi.fn()
    const toC = vi.fn()
    b.command('ping', toB)
    c.command('ping', toC)

    a.send('ping', null, { to: b.id })
    await settle()

    expect(toB).toHaveBeenCalled()
    expect(toC).not.toHaveBeenCalled()
  })

  it('does not echo a command back to the sender', async () => {
    const a = link('t16', 'main')
    const b = link('t16', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    const own = vi.fn()
    a.command('zoom', own)
    a.send('zoom', {})
    await settle()

    expect(own).not.toHaveBeenCalled()
  })
})

describe('navigation', () => {
  it('reaches the addressed surface', async () => {
    const a = link('t17', 'main')
    const b = link('t17', 'inspector')
    await Promise.all([a.whenReady(), b.whenReady()])

    const nav = vi.fn()
    b.on('nav', nav)

    a.navigate('inspector', '/gene/TP53')
    await settle()

    expect(nav).toHaveBeenCalledWith(expect.objectContaining({ surface: 'inspector', to: '/gene/TP53' }))
  })

  it('is ignored by windows rendering a different surface', async () => {
    const a = link('t18', 'main')
    const b = link('t18', 'inspector')
    const c = link('t18', 'preview')
    await Promise.all([a.whenReady(), b.whenReady(), c.whenReady()])

    const onC = vi.fn()
    // Surfaces filter by name; `c` hears the message but must not act on it.
    c.on('nav', (p) => {
      if (p.surface === c.role) onC(p)
    })

    a.navigate('inspector', '/gene/TP53')
    await settle()

    expect(onC).not.toHaveBeenCalled()
  })
})

describe('isolation', () => {
  it('keeps separate channels from hearing each other', async () => {
    const a = link('chan-a', 'main')
    const b = link('chan-b', 'main')
    await Promise.all([a.whenReady(), b.whenReady()])

    a.set('secret', 'a-only')
    await settle()

    expect(b.get('secret')).toBeUndefined()
    expect(b.others).toHaveLength(0)
  })
})

describe('lifecycle', () => {
  it('tolerates close() being called twice', async () => {
    const a = link('t19', 'main')
    await a.whenReady()
    a.close()
    expect(() => a.close()).not.toThrow()
  })

  it('reports diagnostics', async () => {
    const a = link('t20', 'main')
    await a.whenReady()
    expect(a.diagnostics.transport).toBe('memory')
    expect(a.diagnostics.protocol).toBe(1)
    expect(a.diagnostics.ready).toBe(true)
  })
})
