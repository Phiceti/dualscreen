# How it works

Useful if you're evaluating whether to trust this in production, or debugging something odd.

## The protocol

Every message is an envelope:

```ts
{ p: 1, id: 'a3f9…', from: 'main-4c2b', to: '*', t: 'patch', c: 42, d: { … } }
```

`c` is a Lamport clock: incremented on send, and set to `max(local, received) + 1` on receive. Peers
speaking a different `p` are **ignored rather than crashed on** — a stale tab left open across a deploy
must not break a fresh one.

| Type | Meaning |
| --- | --- |
| `hello` | I joined. Broadcast on open and on leadership change. |
| `welcome` | The leader's reply: a full state + presence snapshot. Targeted. |
| `bye` | Clean exit, sent on `pagehide`. |
| `patch` | One shared-state key changed. |
| `nav` | A surface was told to navigate. |
| `cmd` | A user-defined command. |
| `ping` / `pong` | Liveness, only where Web Locks is unavailable. |

## Leader election

One window is leader. Its **only** privilege is answering `hello` with a snapshot — which keeps a late
joiner from receiving N conflicting replies. Nothing else needs a leader, so a brief gap between one
dying and the next being elected is harmless.

The mechanism is the **Web Locks API**. A window requests an exclusive lock and holds it for its entire
lifetime; whoever holds it is leader.

This is the right primitive for a specific reason: the browser releases the lock the instant the holder
goes away — **including a crash or a force-quit**, where no `unload` handler would ever run. Election is
immediate, and there is no heartbeat interval and no timeout that is wrong on somebody's machine.

Where Web Locks is missing, the fallback is "the first peer in the presence list leads". Presence orders
peers by join time, so the oldest surviving window leads and leadership doesn't flap when a window
joins.

## Presence

Clean exits are easy — broadcast `bye` on `pagehide`. Unclean exits are the hard part: a crashed tab, a
force-quit browser, a closed laptop lid. None of those fire an unload handler, so a naive registry
accumulates ghosts forever.

Web Locks solves this exactly rather than approximately. Each window holds a lock **named after its own
peer id**, and `navigator.locks.query()` reports which of those locks are still held. Any peer in the
registry without a live lock is definitively gone. No heartbeat, no timeout, no guessing.

A sweep runs every three seconds. Without Web Locks it falls back to last-seen timestamps refreshed by
periodic pings — the usual approximation, with the usual tradeoff.

::: info A deliberate safety check
The sweep never prunes when `locks.query()` returns an empty set. An empty result means the query is
unreliable, not that every peer died.
:::

## Shared state convergence

There is no server ordering writes, so ordering must be derivable identically on every peer from the
message alone. Each entry carries `(version, origin)`:

```
incoming wins if  incoming.version > current.version
               or (versions equal and incoming.origin > current.origin)
```

The tiebreak is arbitrary; the point is that it is the same arbitrary answer everywhere. The map
converges regardless of message order. This is verified by a
[split-brain test](https://github.com/phiceti/dualscreen/blob/main/packages/core/test/link.test.ts):
two windows write the same key before either has seen the other, and both must land on the same value.

## The join handshake

```
new window                        leader
    │                                │
    ├──── hello ────────────────────▶│
    │                                ├─ snapshot non-ephemeral state
    │◀─────────────── welcome ───────┤
    │                                │
    ├─ hydrate, seed defaults, ready │
```

A window that is genuinely alone would wait forever for a reply, so the handshake races the `welcome`
against a 250 ms timeout — whichever arrives first settles it. `initialState` defaults are applied
*after* settling and yield to any value the snapshot already provided, so every window can declare
identical defaults without racing.

## Ephemeral coalescing

`useEphemeral` wraps writes in a `requestAnimationFrame` throttle that keeps only the newest value. A
burst of N calls within one frame produces exactly one send. It falls back to a 16 ms `setTimeout`
where `requestAnimationFrame` is unavailable — background tabs, workers, Node.

## Why `pagehide`, not `unload`

`unload` doesn't fire reliably, and registering it disqualifies the page from the back/forward cache.
`pagehide` fires on navigation, tab close, and bfcache entry, which makes it the best clean-exit signal
available. Note the ordering in `close()`: the `bye` message is posted *before* the transport is torn
down, or it would never ship.

## Threat model

Windows on the same channel share an origin, so they already share cookies, `localStorage`, and session.
`dualscreen` grants no capability that same-origin script didn't already have. `BroadcastChannel` cannot
cross origins.

The one thing worth stating: **the channel name is not a secret.** Any script running on your origin can
join it. If you have untrusted third-party scripts on the page, they can read and write your shared
state — but they could already read your cookies, so this is not a new exposure.
