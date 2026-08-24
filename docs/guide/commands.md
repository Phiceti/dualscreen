# Commands and events

Shared state is for values worth remembering. **Commands** are for things that happen.

```tsx
import { useCommand, useSend } from 'dualscreen/react'

// sender
const send = useSend()
send('flash', { colour: 'blue' })

// receiver, in another window
useCommand<{ colour: string }>('flash', (args, from) => {
  flashScreen(args.colour)
})
```

## When to use which

| Use shared state | Use a command |
| --- | --- |
| The current selection | "Re-run the analysis" |
| Which slide we're on | "Flash the screen" |
| Zoom level, filters, route | "Export this view" |
| Anything a late-joining window needs | Anything a late-joining window should **not** replay |

The test: **would replaying this to a window that opens in five minutes be correct?** If yes, it's
state. If it would be confusing or wrong, it's a command.

A command that fires while no other window is open is simply lost, which is usually what you want. If
losing it would be a bug, it wasn't a command.

## Targeting one window

```tsx
send('latency-pong', id, { to: peerId })
```

Without `to`, commands broadcast to every other window. Peer ids come from `usePeers()`, or from the
`from` argument of a command you received — which is how the linked-brushing demo echoes its latency
probe back to whoever sent it.

## Commands never echo

A window does not receive its own commands. If you need the local effect too, call it directly:

```tsx
const flash = () => {
  flashScreen()      // here
  send('flash')      // and everywhere else
}
```

## Handlers stay fresh

`useCommand` holds your handler in a ref, so it can close over current props and state without
resubscribing on every render. You don't need `useCallback`.

## Lifecycle events

For link-level events rather than app-level ones, subscribe on the link directly:

```tsx
const { link } = useDualScreen()

useEffect(() => link.on('peers', (peers) => console.log(peers)), [link])
```

| Event | Fires when |
| --- | --- |
| `peers` | A window joined or left |
| `leader` | This window gained or lost leadership |
| `state` | Any shared key changed |
| `nav` | A surface was told to navigate |
| `ready` | The join handshake settled |

Most apps want the hooks — `usePeers()`, `useIsLeader()`, `useLinkReady()` — rather than these directly.
