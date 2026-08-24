# @dualscreen/react

```ts
import { DualScreen, useShared, useSurface /* … */ } from 'dualscreen/react'
// or
import { … } from '@dualscreen/react'
```

## Components

### `<DualScreen>`

Root provider. One per app.

```tsx
<DualScreen channel="my-app" initialState={{ zoom: 1 }} debug>
```

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `channel` | `string` | — | **Required.** Namespace. Windows only talk to windows on the same channel. |
| `role` | `string` | from `?ds=` | Override which surface this window renders. |
| `initialState` | `Record<string, unknown>` | — | Defaults published once, yielding to any existing value. |
| `placement` | `'auto' \| 'window' \| 'split'` | `'auto'` | Force a rung of the placement ladder instead of letting the browser decide. |
| `splitDirection` | `'row' \| 'column'` | `'row'` | Axis for the split fallback. |
| `splitRatio` | `number` | `0.5` | Initial fraction given to the main pane. |
| `transport` | `Transport` | BroadcastChannel | Replace the message channel. |
| `meta` | `Record<string, unknown>` | — | Metadata advertised in presence. |
| `debug` | `boolean` | `false` | Log every message in and out. |

### `<DualScreen.Main>`

Renders children only in the primary window. Accepts `className` and `style`, which apply only when a
split pane is active.

### `<DualScreen.Surface>`

```tsx
<DualScreen.Surface name="inspector" className="my-pane">
```

Renders children when this window **is** that surface, or inline beside `Main` on a single display.

| Prop | Type | |
| --- | --- | --- |
| `name` | `string` | **Required.** Matches `useSurface(name)`. |
| `className` / `style` | | Applied to the pane wrapper. |

Style hooks: `[data-ds-pane="main"]`, `[data-ds-pane="surface"]`, `[data-ds-surface="name"]`,
`[data-ds-inline]`, `[data-ds-divider]`, `[data-dualscreen-root][data-ds-mode]`.

## Hooks

### `useShared`

```ts
function useShared<T>(
  key: string,
  initialValue?: T,
  options?: { ephemeral?: boolean; throttle?: 'raf' | number },
): [T, (value: T | ((previous: T) => T)) => void]
```

A value replicated to every window. `initialValue` is a **read fallback only** and is never written —
use `initialState` on the provider to publish real defaults.

```tsx
const [gene, setGene] = useShared<string | null>('gene', null)
setGene('TP53')
setGene((prev) => prev ?? 'TP53')
```

### `useEphemeral`

```ts
function useEphemeral<T>(key: string, initialValue?: T): [T, (value: T | ((p: T) => T)) => void]
```

`useShared` with `{ ephemeral: true, throttle: 'raf' }`. Writes coalesce onto animation frames and the
value is excluded from late-join snapshots. For cursors, hover, and scrub position.

### `useSharedState`

```ts
function useSharedState(): Record<string, unknown>
```

Every shared value at once. Re-renders on any change — prefer `useShared`.

### `useSurface`

```ts
function useSurface(name: string): SurfaceHandle
```

| Member | Type | |
| --- | --- | --- |
| `open` | `(options?) => Promise<void>` | Open it. **Call directly in a click handler.** |
| `close` | `() => void` | Close it. |
| `focus` | `() => void` | Bring it to the front. |
| `navigate` | `(to: string) => void` | Drive its route. Durable across reloads. |
| `route` | `string \| null` | The route it is showing. |
| `isOpen` | `boolean` | A window or pane is showing. |
| `isConnected` | `boolean` | A peer rendering it is actually connected. Prefer this. |
| `isOpening` | `boolean` | `open()` is in flight. |
| `isInline` | `boolean` | Rendering as a split pane. |
| `mode` | `'auto' \| 'manual' \| 'split'` | What placement the browser allowed. |
| `error` | `Error \| null` | Last `open()` failure. |

`open()` accepts `{ screen, fullscreen, fill, placement, name, remember }` — see
[`openSurfaceWindow`](/api/screens#opensurfacewindow).

### `useSurfaceRoute`

```ts
function useSurfaceRoute(surface?: string): string | null
```

The route this surface was told to show. Call with no argument inside a surface.

### `usePeers`

```ts
function usePeers(): PeerInfo[]
```

Every connected window, including this one, ordered oldest first.

### `useCommand` / `useSend`

```ts
function useCommand<T>(name: string, handler: (args: T, from: string) => void): void
function useSend(): (name: string, args?: unknown, options?: { to?: string }) => void
```

One-off events. The handler is held in a ref, so no `useCallback` is needed. Commands never echo to the
sender.

### `useScreens`

```ts
function useScreens(): {
  layout: ScreenLayout | null
  mode: 'auto' | 'manual' | 'split'
  isExtended: boolean
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
  request: () => Promise<ScreenLayout>
}
```

`isExtended` is readable without prompting — gate your UI on it.

### `useIsLeader` / `useLinkReady`

```ts
function useIsLeader(): boolean
function useLinkReady(): boolean
```

`useLinkReady` is `false` until the join handshake settles. Reads before then may be stale; writes are
always safe.

### `useDualScreen`

```ts
function useDualScreen(): DualScreenContextValue   // { link, role, isMain, layout, mode, … }
```

Escape hatch to the underlying [`Link`](/api/core#link). Throws outside a provider.
