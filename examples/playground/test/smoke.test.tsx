import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import App, { docsHomeFrom } from '../src/App.js'

/**
 * Smoke tests over the real demo app.
 *
 * These do not assert on chart geometry — they assert that each demo mounts,
 * that the main window renders the main view, and that a window booted as a
 * surface renders only that surface. Those are the paths a broken build would
 * take down first.
 */

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 60)) })

function visit(hash: string, search = '') {
  window.history.replaceState({}, '', `/${search}${hash}`)
}

afterEach(() => {
  cleanup()
  visit('')
})

describe('getting back to the docs', () => {
  it('resolves home by stripping the demo segment off the deploy base', () => {
    // Served under the docs site, at the root and at a Pages project sub-path.
    expect(docsHomeFrom('/demo/')).toBe('/')
    expect(docsHomeFrom('/dualscreen/demo/')).toBe('/dualscreen/')
    expect(docsHomeFrom('/deeply/nested/demo/')).toBe('/deeply/nested/')
  })

  it('offers no home link when served standalone', () => {
    // `pnpm demo` has no docs site above it — a link would go nowhere.
    expect(docsHomeFrom('/')).toBeNull()
    expect(docsHomeFrom('/something-else/')).toBeNull()
    expect(docsHomeFrom('')).toBeNull()
  })

  it('always offers a repository link out of the playground', async () => {
    visit('#/analysis')
    const { container } = render(<App />)
    await settle()
    const repo = container.querySelector('a[href*="github.com"]')
    expect(repo).not.toBeNull()
  })

  it('gives a directly-opened surface window a way back', async () => {
    // No `window.opener` means this was not a popup we spawned, so the
    // surface would otherwise be a dead end.
    visit('#/analysis', '?ds=inspector')
    const { container } = render(<App />)
    await settle()
    const escape = container.querySelector('.surface-escape')
    expect(escape).not.toBeNull()
    expect(escape?.getAttribute('href')).toContain('#/analysis')
  })
})

describe('main window', () => {
  it('renders the analysis demo by default', async () => {
    visit('#/analysis')
    render(<App />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Analysis dashboard')
    expect(screen.getByText('EXP-101')).toBeTruthy()
    expect(screen.getByText(/Open inspector on second screen/)).toBeTruthy()
  })

  it('renders the presenter demo', async () => {
    visit('#/presenter')
    render(<App />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Presenter mode')
    expect(screen.getByText('Speaker notes')).toBeTruthy()
  })

  it('renders the brushing demo', async () => {
    visit('#/brushing')
    render(<App />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Linked brushing')
    expect(screen.getByText(/UMAP embedding/)).toBeTruthy()
  })

  it('falls back to the first demo on an unknown route', async () => {
    visit('#/nope')
    render(<App />)
    await settle()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Analysis dashboard')
  })
})

describe('surface window', () => {
  it('renders only the surface, with none of the site chrome', async () => {
    visit('#/analysis', '?ds=inspector')
    render(<App />)
    await settle()

    // No nav, no intro, no "open" button — this window is just the inspector.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText(/Open inspector on second screen/)).toBeNull()
    expect(screen.getByText('Inspector')).toBeTruthy()
    expect(screen.getByText('Nothing selected yet')).toBeTruthy()
  })

  it('renders the presenter stage surface', async () => {
    visit('#/presenter', '?ds=stage')
    render(<App />)
    await settle()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Two monitors, one app')
  })
})

describe('cross-window selection', () => {
  it('drives the inspector from the main window', async () => {
    visit('#/analysis')
    const main = render(<App />)
    await settle()

    // A second window on the same channel, booted as the inspector surface.
    visit('#/analysis', '?ds=inspector')
    const inspector = render(<App />)
    await settle()

    expect(inspector.container.textContent).toContain('Nothing selected yet')

    visit('#/analysis')
    await act(async () => {
      main.container.querySelectorAll('table.data tbody tr')[2]?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    await settle()

    // Only the id crossed; the inspector rebuilt the view from its own data.
    expect(inspector.container.textContent).toContain('EXP-103')
    expect(inspector.container.textContent).not.toContain('Nothing selected yet')
  })
})
