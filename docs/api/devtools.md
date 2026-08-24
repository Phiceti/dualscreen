# @dualscreen/devtools

A floating panel showing who is connected, what the shared state holds, and protocol traffic as it
happens.

```tsx
import { DualScreenDevtools } from 'dualscreen/devtools'

<DualScreen channel="my-app">
  {/* … */}
  {import.meta.env.DEV && <DualScreenDevtools />}
</DualScreen>
```

Render it in **both** windows. Debugging two windows is genuinely harder than debugging one — you can't
watch two consoles at once, and the interesting failures are the ones where the windows disagree.
Having the panel side by side is usually enough to see the problem immediately.

## Props

| | Type | Default | |
| --- | --- | --- | --- |
| `defaultOpen` | `boolean` | `false` | Start expanded. |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Corner to dock to. |
| `historyLimit` | `number` | `60` | Messages to retain. |

## Tabs

- **state** — every shared key and its current value.
- **peers** — connected windows, which is this one, and which holds leadership.
- **traffic** — live protocol messages with direction, type, and a one-line summary.

The header shows placement mode, leadership, display count, and sent/received counts. The footer shows
the transport and whether Web Locks is active — the two things to check first when windows aren't
talking.

::: tip Zero cost when closed
The protocol tap is only attached while the traffic tab is visible, so the overlay costs nothing on the
hot path the rest of the time.
:::

## Production

The overlay has no `NODE_ENV` guard of its own — gate it yourself so bundlers can drop it:

```tsx
{import.meta.env.DEV && <DualScreenDevtools />}    // Vite
{process.env.NODE_ENV !== 'production' && <DualScreenDevtools />}
```
