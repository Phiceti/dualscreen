# Custom transports

`dualscreen` talks to the outside world through one small interface. Replace it and the entire protocol
— presence, leader election, shared state, commands — rides on whatever you provide.

```ts
interface Transport {
  readonly name: string
  send(envelope: Envelope): void
  subscribe(handler: (envelope: Envelope) => void): () => void
  close(): void
}
```

One rule: **never echo a sender's own messages back to it.** `BroadcastChannel` gets this right by
spec; a relay server has to be told.

## Bundled transports

| | |
| --- | --- |
| `createBroadcastChannelTransport(channel)` | Default. Same origin, same browser, sub-millisecond, no server. |
| `createMemoryTransport(channel)` | In-process. For tests, and for the single-window split-pane case. |

## Using one explicitly

```tsx
import { createMemoryTransport } from 'dualscreen'

<DualScreen channel="my-app" transport={createMemoryTransport('my-app')}>
```

This is exactly what the library's own React tests do — deterministic, no browser APIs needed.

## Writing a WebSocket transport

This is the path to cross-device: phone as a remote, laptop driving a conference display, two people at
two desks.

```ts
import type { Envelope, Transport } from 'dualscreen'

export function createWebSocketTransport(url: string, room: string): Transport {
  const socket = new WebSocket(`${url}?room=${encodeURIComponent(room)}`)
  const handlers = new Set<(e: Envelope) => void>()
  const queue: Envelope[] = []

  socket.addEventListener('open', () => {
    for (const envelope of queue.splice(0)) socket.send(JSON.stringify(envelope))
  })

  socket.addEventListener('message', (event) => {
    const envelope = JSON.parse(event.data) as Envelope
    for (const handler of [...handlers]) handler(envelope)
  })

  return {
    name: 'websocket',
    send(envelope) {
      // Buffer until the socket is open, or the join handshake is lost.
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(envelope))
      else queue.push(envelope)
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => { handlers.delete(handler) }
    },
    close() {
      handlers.clear()
      socket.close()
    },
  }
}
```

Your server's only job is to relay each message to every client in the room **except the sender**.

### What you must handle yourself

A relay is not a drop-in upgrade. Going cross-device means taking on:

- **Authentication and pairing.** Same-origin windows share cookies for free. Two devices do not. You
  need a pairing token, and an authorisation model for who may join a room.
- **Reconnection.** Sockets drop. On reconnect, the joining client must redo the `hello` handshake to
  get a fresh snapshot.
- **JSON, not structured clone.** `Date`, `Map`, and `Set` will not survive `JSON.stringify`. Either
  keep shared state JSON-safe or use a codec such as MessagePack or `devalue`.
- **Latency.** 20–150 ms instead of sub-millisecond. Fine for selections; you will feel it on a
  60 fps crosshair. Consider keeping ephemeral state on a local `BroadcastChannel` and only relaying
  durable state.

This is why v1 ships zero-infrastructure by default. The interface is public so you can make that
trade deliberately, not by accident.

## Combining transports

Nothing stops you fanning out to several:

```ts
function multiplex(...transports: Transport[]): Transport {
  return {
    name: transports.map((t) => t.name).join('+'),
    send: (envelope) => transports.forEach((t) => t.send(envelope)),
    subscribe(handler) {
      const offs = transports.map((t) => t.subscribe(handler))
      return () => offs.forEach((off) => off())
    },
    close: () => transports.forEach((t) => t.close()),
  }
}
```

Local windows then get sub-millisecond delivery while remote devices ride the relay. Deduplicate on
`envelope.id` if a message could arrive by both paths.
