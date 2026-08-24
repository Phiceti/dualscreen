import { afterEach, describe, expect, it, vi } from 'vitest'
import { CrossOriginSurfaceError, openSurfaceWindow } from '../src/open.js'

/**
 * A window opened with `window.open()` hands the opened page a `window.opener`
 * handle back to this one. Cross-origin, that handle lets the opened page
 * navigate its opener — reverse tabnabbing — so a surface URL derived from
 * user input becomes a redirect to an attacker's login page.
 *
 * dualscreen never needs to open cross-origin: `BroadcastChannel` is
 * origin-scoped, so such a window could not join the channel anyway.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cross-origin refusal', () => {
  it('refuses a cross-origin surface URL', async () => {
    const opener = vi.spyOn(window, 'open')

    await expect(openSurfaceWindow({ url: 'https://evil.example.com/steal' })).rejects.toBeInstanceOf(
      CrossOriginSurfaceError,
    )

    // The check has to happen *before* the window exists — once it does, the
    // opener reference has already been handed over.
    expect(opener).not.toHaveBeenCalled()
  })

  it('refuses a protocol-relative URL pointing elsewhere', async () => {
    const opener = vi.spyOn(window, 'open')
    await expect(openSurfaceWindow({ url: '//evil.example.com/steal' })).rejects.toBeInstanceOf(
      CrossOriginSurfaceError,
    )
    expect(opener).not.toHaveBeenCalled()
  })

  it('refuses a scheme change on the same host', async () => {
    const opener = vi.spyOn(window, 'open')
    const other = location.protocol === 'https:' ? 'http:' : 'https:'
    await expect(
      openSurfaceWindow({ url: `${other}//${location.host}/?ds=inspector` }),
    ).rejects.toBeInstanceOf(CrossOriginSurfaceError)
    expect(opener).not.toHaveBeenCalled()
  })

  it('allows a same-origin relative URL', async () => {
    const fake = {
      closed: false,
      moveTo: vi.fn(),
      resizeTo: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      screenX: 0,
      screenY: 0,
      outerWidth: 800,
      outerHeight: 600,
    } as unknown as Window
    const opener = vi.spyOn(window, 'open').mockReturnValue(fake)

    const handle = await openSurfaceWindow({ url: '?ds=inspector', screen: null })

    expect(opener).toHaveBeenCalled()
    expect(handle.window).toBe(fake)
    handle.close()
  })
})
