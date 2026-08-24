# @dualscreen/screens

Display detection and window placement. Every API is feature-detected; nothing throws when the Window
Management API is absent.

```ts
import { getScreenLayout, openSurfaceWindow } from 'dualscreen/screens'
```

## Detection

```ts
isWindowManagementSupported(): boolean
isExtendedDisplay(): boolean
getScreenPermission(): Promise<ScreenPermission>
```

`isExtendedDisplay()` reads `screen.isExtended`, which requires **no permission prompt** — the right
thing to gate UI on.

## Layout

```ts
getScreenLayout(): Promise<ScreenLayout>       // never prompts — safe on page load
requestScreenLayout(): Promise<ScreenLayout>   // prompts if needed — needs a user gesture
watchScreens(onChange): Promise<() => void>    // monitors plugged, unplugged, rearranged
getScreenDetails(): Promise<ScreenDetails | null>
pickTargetScreen(layout): ScreenInfo | null
```

### `ScreenLayout`

```ts
{
  screens: ScreenInfo[]
  current: ScreenInfo | null
  isExtended: boolean
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
  mode: 'auto' | 'manual' | 'split'
}
```

### `ScreenInfo`

```ts
{
  id: string
  label: string                      // OS display name where available
  left, top, width, height: number
  availLeft, availTop, availWidth, availHeight: number   // excludes docks and taskbars
  isPrimary, isInternal, isCurrent: boolean
  devicePixelRatio: number
}
```

`pickTargetScreen` prefers a display that **isn't** the current one, breaking ties toward the largest
external display.

## `openSurfaceWindow`

```ts
openSurfaceWindow(options: OpenSurfaceOptions): Promise<SurfaceWindow>
```

| Option | Type | |
| --- | --- | --- |
| `url` | `string` | **Required.** Normally `surfaceUrl(name)`. |
| `screen` | `ScreenInfo \| 'auto' \| null` | `'auto'` picks the best non-current display. |
| `fullscreen` | `boolean` | Ask the window to go fullscreen on arrival. |
| `placement` | `Partial<Placement>` | Explicit geometry, overriding `screen`. |
| `name` | `string` | Window name. Reusing it refocuses rather than reopening. |
| `remember` | `boolean \| string` | Persist geometry in `localStorage`. |
| `fill` | `number` | Fraction of the display to occupy. Default `1`. |

Returns `{ window, name, placement, isOpen, focus(), close(), onClose(handler) }`.

::: warning Gesture ordering
`window.open()` runs **synchronously before any `await`** — awaiting first would spend the user gesture
and get the popup blocked. The window opens with known geometry, then moves once the layout resolves.
Call it directly from your click handler. See [the gesture rule](/guide/placement#the-gesture-rule).
:::

Throws `PopupBlockedError` if the browser refuses.

## Fullscreen

```ts
enterFullscreenOnScreen(element?, screen?): Promise<boolean>
shouldAutoFullscreen(href?): boolean
```

Call `enterFullscreenOnScreen` **in the secondary window**. Without the Window Management API it falls
back to ordinary fullscreen on whichever display the window already occupies.

## Other exports

```ts
placementForScreen(screen, fill?): Placement
PopupBlockedError
FULLSCREEN_PARAM   // 'dsfs'
```
