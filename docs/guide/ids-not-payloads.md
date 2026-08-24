# Ids, not payloads

This is the single rule that decides whether a cross-window library is usable on real data.

## The rule

```tsx
// ✅ four bytes, regardless of dataset size
setSelected('EXP-102')

// ❌ structured-clones the entire table into every window, on every click
setSelected(rowsForExperiment102)
```

Broadcast the **selector**. Let each window resolve it against its own cache.

## Why it matters more than it looks

`BroadcastChannel` uses [structured
clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
which *copies*. Sending a 200 MB expression matrix doesn't pass a reference — it serialises, copies, and
deserialises the whole thing into every connected window, synchronously blocking the main thread on both
ends. Do that on every row click and the app stops responding.

Sending `'EXP-102'` instead costs nothing and scales to any dataset.

## What "resolve it locally" means in practice

Each window already has a data layer. Let it do its job:

```tsx
function Inspector() {
  const [experimentId] = useShared<string | null>('experimentId', null)

  // React Query, SWR, RTK Query, a plain fetch + cache — whatever you already use.
  const { data } = useQuery({
    queryKey: ['experiment', experimentId],
    queryFn: () => fetchExperiment(experimentId),
    enabled: experimentId != null,
  })

  return <Volcano data={data} />
}
```

`dualscreen` moves the selector. Your data layer moves the data. The two windows are same-origin, so
they share cookies and session — the second window's fetch is authenticated exactly like the first's,
and usually hits the same HTTP cache.

## Selectors bigger than an id

Sometimes the selection isn't one id. The rule generalises: **send the smallest thing that describes the
selection**, not the selection itself.

The linked-brushing demo is the clean example. A brush over 400 points could be sent as 400 ids. Instead
it's sent as a rectangle in data space:

```tsx
const [brush, setBrush] = useShared<BrushRect | null>('brush', null)

setBrush({ x0: -2.1, y0: 0.4, x1: 1.8, y1: 3.2 })   // four numbers
```

Two things follow. The message size doesn't grow with the selection — brushing every point costs the
same as brushing one. And because the rectangle is in *data* space, the receiving window can apply it to
completely different axes at a different pixel size, which a list of screen coordinates could never do.

Other selectors that compress well: a filter predicate's parameters, a time range, a page number plus
sort key, a set of facet values.

## When you genuinely must send data

Sometimes there's no id — a user's unsaved draft, a computed result that only exists in one window.
Options, in order of preference:

1. **Write it somewhere both windows can read.** IndexedDB, then broadcast the key. This is the same
   ids-not-payloads pattern with a local store standing in for the server.
2. **Send it, but only once.** A one-time transfer on open is fine; the problem is per-interaction
   payloads.
3. **Use a `Transferable`.** `ArrayBuffer` can be transferred rather than copied — but note it is
   *neutered* in the sender, so this only suits genuine handoff.

## A quick sanity check

If you can answer "what would this cost if the dataset were 100× bigger?" with "the same", you're
following the rule.
