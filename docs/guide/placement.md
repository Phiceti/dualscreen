# Opening and placing windows

```tsx
const inspector = useSurface('inspector')

<button onClick={() => inspector.open()}>Open on second screen</button>
```

That's the normal case. This page covers what happens underneath and how to control it.

## The gesture rule

Popup blockers reject `window.open()` unless a user gesture is still on the stack — and `await`ing even
an already-resolved promise is enough to lose it.

This creates a real ordering problem, because asking for display permission is itself asynchronous. If
we asked first and opened second, the popup would be blocked every time.

So `open()` is deliberately ordered the other way:

1. **Synchronously** call `window.open()` with whatever geometry is already known — a remembered
   position, or the browser default.
2. *Then* resolve the display layout, prompting for permission if needed.
3. Move and resize the window into place.

A same-origin window you opened can be moved without a fresh gesture, so the result is identical and the
popup actually appears. The cost is that on a first-ever open you may briefly see the window before it
jumps to the right monitor; on subsequent opens the remembered position usually makes that invisible.

**What this means for you:** call `open()` directly in the handler.

```tsx
// ✅
onClick={() => inspector.open()}

// ❌ gesture already spent
onClick={async () => { await save(); inspector.open() }}
```

## Options

```tsx
inspector.open({
  screen: 'auto',        // 'auto' | ScreenInfo | null
  fullscreen: true,      // ask the window to go fullscreen on arrival
  fill: 0.9,             // fraction of the display to occupy
  remember: 'my-key',    // persist geometry under this key
})
```

### Choosing the display

`'auto'` (the default) picks the best display that **isn't** the one showing the current window — the
whole point is to use the *other* monitor — breaking ties toward the largest external display.

To choose explicitly:

```tsx
const { layout } = useScreens()
const target = layout?.screens.find((s) => s.label.includes('DELL'))
inspector.open({ screen: target })
```

### Fullscreen

`fullscreen: true` adds a hint to the surface URL; the opened window sees it and calls
`requestFullscreen` on arrival. This needs the Window Management API to target a *specific* display —
without it, the window still goes fullscreen, just on whichever display it already occupies. Which is
the right outcome once the user has dragged it there.

### Remembered geometry

By default each surface remembers where it was, keyed by channel and surface name, in `localStorage`.
Reopening puts it back. Storage failures — private mode, blocked cookies — are swallowed: remembering
geometry is a convenience and must never prevent the window from opening.

## Reading the display layout

```tsx
const { layout, mode, isExtended, permission, request } = useScreens()
```

`isExtended` comes from `screen.isExtended`, which is readable **without any permission prompt**. That
makes it the right thing to gate UI on — you can decide whether to show a "second screen" button at all
before ever asking the user for anything.

```tsx
{isExtended && <button onClick={() => inspector.open()}>Open on second screen</button>}
```

`request()` prompts for the `window-management` permission and re-reads the layout. You rarely need to
call it — `open()` does it for you.

## Closing and focusing

```tsx
inspector.close()
inspector.focus()
inspector.isOpen        // a window or pane is showing
inspector.isConnected   // a peer rendering that surface is actually connected
```

`isConnected` is presence-derived and therefore authoritative: a window that reloaded, or one the user
opened by pasting the URL, counts just as much as one you opened. Prefer it for UI state.

The library polls for the window being closed by hand, since there is no observable `close` event from
the opener side.
