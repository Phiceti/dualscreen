# The degradation ladder

`dualscreen` never asks you to write two versions of anything. The same `open()` call and the same
`<DualScreen.Surface>` JSX produce the best available outcome on whatever the user is running.

## The four rungs

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Chromium · permission granted · second display attached          │
│    → window opens ON monitor 2, sized to it, optionally fullscreen  │
│    mode: 'auto'                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ 2. Chromium · permission denied or not yet asked                    │
│    → popup opens; user drags it once; position is remembered        │
│    mode: 'manual'                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 3. Safari / Firefox · no Window Management API                      │
│    → popup opens; user drags it once; position is remembered        │
│    mode: 'manual'                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 4. One display                                                      │
│    → renders inline as a resizable split pane, same component tree  │
│    mode: 'split'                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Synchronisation is identical on all four.** Only placement varies.

## Reading the current rung

```tsx
const inspector = useSurface('inspector')
inspector.mode   // 'auto' | 'manual' | 'split'

const { mode, isExtended, permission } = useScreens()
```

Most apps never need this. Use it to set expectations in your UI:

```tsx
<button onClick={() => inspector.open()}>
  {inspector.mode === 'auto' ? 'Open on second screen' : 'Open inspector'}
</button>
```

## The split-pane fallback

On one display, `open()` renders the surface **inline**, beside `<DualScreen.Main>`, with a draggable
divider between them.

This is not a second code path. `<DualScreen.Surface>` renders the same children either way; only the
container differs. There is nothing extra to test and no risk of the two versions drifting apart.

```tsx
<DualScreen channel="my-app" placement="auto" splitDirection="row" splitRatio={0.5}>
```

| Prop | Default | |
| --- | --- | --- |
| `placement` | `'auto'` | `'window'` always opens a real window; `'split'` always renders inline |
| `splitDirection` | `'row'` | `'column'` stacks vertically |
| `splitRatio` | `0.5` | Initial fraction given to the main pane |

### Overriding the ladder

`placement` forces a rung instead of letting the browser decide:

```tsx
<DualScreen placement="split">   // always inline, even with a second monitor
<DualScreen placement="window">  // always a real window, even on one monitor
```

`'split'` is what an embedded view wants, and it's the natural backing for a
"show detail inline" user preference. `'window'` suits a kiosk or signage setup
where the second output is always present.

Style the panes with `data-ds-pane="main"`, `data-ds-pane="surface"`, and `data-ds-divider`, or pass
`className` / `style` to `<DualScreen.Main>` and `<DualScreen.Surface>`.

::: tip Zero layout impact when not splitting
The provider's wrapper element uses `display: contents` unless a split is actually active, so adding
`dualscreen` to an existing app never shifts anything on screen.
:::

## Blocked popups fall through

If the browser blocks the popup anyway, `open()` catches it and **falls back to the split pane** rather
than surfacing an error. A blocked popup is recoverable and a split pane is a genuinely usable answer,
so taking it is better than showing the user a failure they can't act on.

The error is still available on `inspector.error` if you want to say something about it.

## Testing the rungs

- **`mode: 'split'`** — unplug the second monitor, or test in any environment without the Window
  Management API (jsdom and happy-dom both land here, which is what the library's own test suite uses).
- **`mode: 'manual'`** — deny the display permission in Chrome's site settings, or use Safari/Firefox.
- **`mode: 'auto'`** — Chromium with two displays and permission granted.

The bundled demos exercise all of these; resize your browser to one monitor and watch the split pane
appear live.
