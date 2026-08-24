# @dualscreen/core

Framework-agnostic. No React dependency.

```ts
import { createLink } from 'dualscreen'
```

## `createLink`

```ts
function createLink(options: LinkOptions): Link
```

```ts
const link = createLink({ channel: 'my-app' })

link.set('selected', 'EXP-102')
link.subscribeKey('selected', (id) => render(id))

await link.whenReady()
link.close()
```

### `LinkOptions`

| | Type | Default | |
| --- | --- | --- | --- |
| `channel` | `string` | — | **Required.** Namespace. |
| `role` | `string` | from `?ds=` | Surface this window renders. |
| `transport` | `Transport` | BroadcastChannel | Message channel. |
| `meta` | `Record<string, unknown>` | — | Advertised in presence. |
| `initialState` | `Record<string, unknown>` | — | Defaults, applied after the handshake. |
| `snapshotTimeout` | `number` | `250` | Ms to wait for a snapshot before assuming we're alone. |
| `debug` | `boolean` | `false` | Trace the protocol. |

## `Link`

### Identity

| | |
| --- | --- |
| `id` | This window's peer id. |
| `role` | Surface name. `'main'` for the primary window. |
| `channel` | The channel namespace. |
| `isLeader` | Whether this window holds leadership. |
| `isReady` | Whether the handshake settled. |
| `peers` | Every connected window, oldest first. |
| `others` | Peers other than this one. |
| `diagnostics` | `{ transport, leaderStrategy, protocol, clock, sent, received, ready }` |

### State

```ts
link.get<T>(key): T | undefined
link.getAll(): Record<string, unknown>
link.set(key, value, options?: { ephemeral?: boolean }): void
link.subscribe((state, changedKeys) => void): () => void
link.subscribeKey<T>(key, (value) => void): () => void
```

### Commands

```ts
link.send(name, args?, options?: { to?: string }): void
link.command(name, (args, from) => void): () => void
```

### Navigation

```ts
link.navigate(surface, to, options?: { replace?: boolean }): void
```

Emits a one-shot `nav` event. For durable routing that survives reloads, prefer
`useSurface().navigate()` in React, which writes to shared state instead.

### Events and lifecycle

```ts
link.on('peers' | 'leader' | 'state' | 'nav' | 'ready', handler): () => void
link.tap((envelope, direction) => void): () => void
link.whenReady(): Promise<void>
link.close(): void
```

`tap` observes every envelope in and out — it's what the devtools overlay uses. It runs on the hot path,
so keep handlers cheap. `close()` is idempotent and is called automatically on `pagehide`.

## Transports

```ts
createBroadcastChannelTransport(channel: string): Transport
createMemoryTransport(channel: string): Transport
resetMemoryTransports(): void
isBroadcastChannelSupported(): boolean
```

See [Custom transports](/guide/transports) for writing your own.

## Surface helpers

```ts
readSurface(href?): string            // 'main' or the ?ds= value
isSecondarySurface(href?): boolean
surfaceUrl(name, { base?, route? }): string
SURFACE_PARAM   // 'ds'
MAIN_SURFACE    // 'main'
```

## Lower-level building blocks

Exported for advanced use and for testing.

```ts
createStateStore(selfId): StateStore
createLeaderElection({ name, peerId, onChange }): LeaderElection
createPresence({ channel, self, onChange, staleMs? }): Presence
isWebLocksSupported(): boolean
```

## Utilities

```ts
rafThrottle<T>(fn): ((value: T) => void) & { cancel(): void }
throttle<T>(fn, ms): ((value: T) => void) & { cancel(): void }
shallowEqual(a, b): boolean
uid(prefix?): string
Emitter<Events>
```

## Types

`Envelope`, `MessageType`, `Transport`, `PeerInfo`, `StateEntry`, `StateMap`, `LinkOptions`,
`LinkEvents`, `TapHandler`, `TapDirection`, `HelloPayload`, `WelcomePayload`, `PatchPayload`,
`NavPayload`, `CmdPayload`, `PROTOCOL_VERSION`.
