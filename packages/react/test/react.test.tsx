import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createMemoryTransport, resetMemoryTransports } from '@dualscreen/core'
import { DualScreen } from '../src/components.js'
import { useShared, useSurface, usePeers } from '../src/hooks.js'

afterEach(() => {
  cleanup()
  resetMemoryTransports()
})

/** Let the join handshake and transport settle. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })

function Wrapper({
  channel,
  role,
  placement,
  children,
}: {
  channel: string
  role: string
  placement?: 'auto' | 'window' | 'split'
  children: React.ReactNode
}) {
  return (
    <DualScreen channel={channel} role={role} placement={placement} transport={createMemoryTransport(channel)}>
      {children}
    </DualScreen>
  )
}

describe('useShared', () => {
  function Reader({ label }: { label: string }) {
    const [gene] = useShared<string | null>('gene', null)
    return <span data-testid={label}>{gene ?? 'none'}</span>
  }
  function Writer() {
    const [, setGene] = useShared<string | null>('gene', null)
    return <button onClick={() => setGene('TP53')}>set</button>
  }

  it('propagates a write from one window to another', async () => {
    render(<Wrapper channel="r1" role="main"><Writer /><Reader label="a" /></Wrapper>)
    render(<Wrapper channel="r1" role="inspector"><Reader label="b" /></Wrapper>)
    await settle()

    expect(screen.getByTestId('b').textContent).toBe('none')
    await act(async () => { screen.getByText('set').click() })
    await settle()

    expect(screen.getByTestId('a').textContent).toBe('TP53')
    expect(screen.getByTestId('b').textContent).toBe('TP53')
  })

  it('gives a late-mounting window the current value', async () => {
    render(<Wrapper channel="r2" role="main"><Writer /></Wrapper>)
    await settle()
    await act(async () => { screen.getByText('set').click() })
    await settle()

    render(<Wrapper channel="r2" role="inspector"><Reader label="late" /></Wrapper>)
    await settle()

    expect(screen.getByTestId('late').textContent).toBe('TP53')
  })
})

describe('surface rendering', () => {
  const tree = (
    <>
      <DualScreen.Main><span data-testid="main">MAIN</span></DualScreen.Main>
      <DualScreen.Surface name="inspector"><span data-testid="surface">SURFACE</span></DualScreen.Surface>
    </>
  )

  it('renders only Main in the primary window', async () => {
    render(<Wrapper channel="r3" role="main">{tree}</Wrapper>)
    await settle()
    expect(screen.queryByTestId('main')).not.toBeNull()
    expect(screen.queryByTestId('surface')).toBeNull()
  })

  it('renders only the matching Surface in a secondary window', async () => {
    render(<Wrapper channel="r4" role="inspector">{tree}</Wrapper>)
    await settle()
    expect(screen.queryByTestId('main')).toBeNull()
    expect(screen.queryByTestId('surface')).not.toBeNull()
  })

  it('renders nothing for a surface this window does not own', async () => {
    render(<Wrapper channel="r5" role="preview">{tree}</Wrapper>)
    await settle()
    expect(screen.queryByTestId('main')).toBeNull()
    expect(screen.queryByTestId('surface')).toBeNull()
  })
})

describe('useSurface', () => {
  function Status() {
    const inspector = useSurface('inspector')
    return (
      <span data-testid="status">
        {inspector.isConnected ? 'connected' : 'alone'}:{inspector.mode}
      </span>
    )
  }

  it('reports a connected surface via presence', async () => {
    render(<Wrapper channel="r6" role="main"><Status /></Wrapper>)
    await settle()
    expect(screen.getByTestId('status').textContent).toContain('alone')

    render(<Wrapper channel="r6" role="inspector"><span /></Wrapper>)
    await settle()

    expect(screen.getByTestId('status').textContent).toContain('connected')
  })

  it('falls back to split mode where no second display is addressable', async () => {
    render(<Wrapper channel="r7" role="main"><Status /></Wrapper>)
    await settle()
    // happy-dom has no Window Management API, which is exactly the Safari /
    // Firefox situation — the ladder must land on 'split', not throw.
    expect(screen.getByTestId('status').textContent).toContain('split')
  })

  it('renders the surface inline once opened in split mode', async () => {
    function Opener() {
      const inspector = useSurface('inspector')
      return <button onClick={() => void inspector.open()}>open</button>
    }
    render(
      <Wrapper channel="r8" role="main">
        <Opener />
        <DualScreen.Main><span data-testid="main">MAIN</span></DualScreen.Main>
        <DualScreen.Surface name="inspector"><span data-testid="surface">SURFACE</span></DualScreen.Surface>
      </Wrapper>,
    )
    await settle()
    expect(screen.queryByTestId('surface')).toBeNull()

    await act(async () => { screen.getByText('open').click() })
    await settle()

    // Both panes now render in the one window, with no change to app code.
    expect(screen.queryByTestId('main')).not.toBeNull()
    expect(screen.queryByTestId('surface')).not.toBeNull()
  })
})

describe('placement override', () => {
  function Mode() {
    const inspector = useSurface('inspector')
    return <span data-testid="mode">{inspector.mode}</span>
  }

  it("forces a real window with placement='window' even on one display", async () => {
    render(
      <Wrapper channel="p1" role="main" placement="window">
        <Mode />
      </Wrapper>,
    )
    await settle()
    // Without the override this environment would land on 'split'; 'manual'
    // means "a window opened, you position it".
    expect(screen.getByTestId('mode').textContent).toBe('manual')
  })

  it("pins to the split pane with placement='split'", async () => {
    render(
      <Wrapper channel="p2" role="main" placement="split">
        <Mode />
      </Wrapper>,
    )
    await settle()
    expect(screen.getByTestId('mode').textContent).toBe('split')
  })

  it('follows the browser by default', async () => {
    render(
      <Wrapper channel="p3" role="main">
        <Mode />
      </Wrapper>,
    )
    await settle()
    expect(screen.getByTestId('mode').textContent).toBe('split')
  })
})

describe('usePeers', () => {
  function PeerCount() {
    const peers = usePeers()
    return <span data-testid="count">{peers.length}</span>
  }

  it('counts every connected window', async () => {
    render(<Wrapper channel="r9" role="main"><PeerCount /></Wrapper>)
    await settle()
    expect(screen.getByTestId('count').textContent).toBe('1')

    render(<Wrapper channel="r9" role="inspector"><span /></Wrapper>)
    await settle()
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
