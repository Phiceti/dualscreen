# Shared state

Every window on a channel replicates one key/value map. `useShared` reads and writes it.

```tsx
const [gene, setGene] = useShared<string | null>('gene', null)

setGene('TP53')            // every window sees it
setGene((prev) => prev ?? 'TP53')   // updater form works too
```

## How conflicts resolve

There is no server ordering writes, so ordering has to be derivable identically on every peer from the
message alone. Each entry carries `(version, origin)`:

- A write bumps `version` past the highest the writer has seen **for that key**.
- Ties — two windows writing the same key in the same instant — break on the lexicographically larger
  `origin` peer id.

The tiebreak is arbitrary. The point is that it's the *same* arbitrary answer everywhere, so the map
converges no matter what order messages arrive in.

This is **last-writer-wins per key**, and it's the honest fit for the shape `dualscreen` targets: one
window drives, others follow. It is not a CRDT. If two windows must edit the same structure concurrently
and both edits have to survive, reach for Yjs and use `dualscreen` as its
[transport](/guide/transports).

## Defaults

`useShared`'s second argument is a **local read fallback only**. It is never written.

```tsx
const [zoom] = useShared('zoom', 1)   // shows 1 until someone writes a real value
```

That's deliberate: if mounting a component wrote its default, opening a second window would clobber
whatever the first window had already set. To publish real defaults, declare them once on the provider:

```tsx
<DualScreen channel="my-app" initialState={{ zoom: 1, panel: 'summary' }}>
```

`initialState` yields to any value another window already holds, so every window can declare identical
defaults without racing.

## Ephemeral state

Some values describe *right now* — cursor position, hover target, scrub head. Replaying those to a
window that opens thirty seconds later isn't stale, it's **wrong**.

```tsx
import { useEphemeral } from 'dualscreen/react'

const [hovered, setHovered] = useEphemeral<string | null>('hovered', null)
```

`useEphemeral` differs from `useShared` in two ways:

1. **rAF coalescing.** A burst of writes within one animation frame produces exactly one message,
   carrying the last value. A 60fps pointer stream therefore cannot flood the channel no matter how fast
   the input device reports.
2. **Excluded from snapshots.** A late-joining window is never handed the value.

It's exactly `useShared(key, initial, { ephemeral: true, throttle: 'raf' })`, which you can also spell
out if you want one behaviour without the other:

```tsx
useShared('scrub', 0, { throttle: 50 })            // throttled, but replayed to late joiners
useShared('cursor', null, { ephemeral: true })      // not replayed, but every write sends
```

## Late join

When a window opens it broadcasts `hello`. The elected leader replies with a snapshot of all
non-ephemeral state — **exactly one reply, because there is exactly one leader**. Until that settles (or
a short timeout expires, for a window that is genuinely alone), `useLinkReady()` returns `false`.

```tsx
const ready = useLinkReady()
if (!ready) return <Skeleton />
```

Reads before ready may be stale. Writes are always safe.

## Reading everything

```tsx
const state = useSharedState()   // { gene: 'TP53', zoom: 4, … }
```

Prefer `useShared` unless you truly need all keys — `useSharedState` re-renders on any change.

## Structured-clone rules

Values cross the wire via `postMessage`, so they must be structured-cloneable: plain objects, arrays,
`Date`, `Map`, `Set`, typed arrays. **Not** functions, DOM nodes, or class instances with methods.

If you pass something uncloneable, `dualscreen` logs a specific error rather than failing silently:

> failed to post "patch" — payload is not structured-cloneable. Shared state must be plain JSON-like
> data; send an id and re-fetch instead.

That last clause is the real advice — see [Ids, not payloads](/guide/ids-not-payloads).
