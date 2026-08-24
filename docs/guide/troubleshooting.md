# Troubleshooting

## The popup is blocked

Almost always the gesture rule. `window.open()` must run while a user gesture is still on the stack.

```tsx
// ❌ the await spends the gesture
onClick={async () => { await save(); inspector.open() }}

// ✅
onClick={() => inspector.open()}
```

If you must do async work, do it *after*:

```tsx
onClick={() => { inspector.open(); void save() }}
```

When a popup is blocked anyway, `open()` falls back to the split pane rather than failing. Check
`inspector.error` to detect it.

## The windows don't see each other

Work through these in order:

1. **Same channel string?** `channel` must match exactly. Typos are the most common cause.
2. **Same origin?** `localhost:5173` and `127.0.0.1:5173` are *different origins*. So are http and https.
3. **Same browser profile?** A normal window and an incognito window cannot see each other. Neither can
   two different browsers.
4. **Is `BroadcastChannel` available?** Check `link.diagnostics.transport`. If it says `memory`,
   `BroadcastChannel` was missing and the windows are isolated by definition.

The devtools overlay shows all of this at a glance — render it in both windows and compare.

## State arrives, then gets overwritten by a default

You're writing a default rather than declaring one.

```tsx
// ❌ every mount writes, clobbering the other window
useEffect(() => setZoom(1), [])

// ✅ declared once, yields to any existing value
<DualScreen channel="app" initialState={{ zoom: 1 }}>
```

`useShared`'s second argument is a read fallback and never writes, so it is always safe.

## A surface window shows stale or missing data after reload

Check whether the value is ephemeral. `useEphemeral` values are deliberately excluded from the snapshot
handed to a joining window — replaying a cursor position from a minute ago would be wrong, not merely
old. If a value must survive a reload, use `useShared`.

For routes, prefer `inspector.navigate()` over a `nav` event; `navigate()` writes to shared state and is
therefore part of the snapshot.

## "payload is not structured-cloneable"

Something in shared state isn't cloneable — a function, a DOM node, a class instance with methods, a
React element.

```tsx
// ❌
setSelected(<Detail />)
setSelected({ render: () => …, data })

// ✅
setSelected(row.id)
```

The real fix is almost always [ids, not payloads](/guide/ids-not-payloads).

## Everything re-renders constantly

Usually `useSharedState()`, which fires on *any* key change. Subscribe to the specific key instead:

```tsx
// ❌ re-renders when anything changes
const state = useSharedState()
const gene = state.gene

// ✅
const [gene] = useShared('gene')
```

Second most common: a high-frequency value written with `useShared` instead of `useEphemeral`.

## Two windows both think they're leader

Briefly possible during an election and harmless — the only consequence is a joining window receiving
two snapshots, which converge anyway. If it persists, check `link.diagnostics.leaderStrategy`. `peer-id`
means Web Locks was unavailable and election is only as accurate as presence.

## Ghost peers that never disappear

`usePeers()` showing windows that are closed means crash-safe presence isn't active — check
`leaderStrategy`. On the timestamp fallback, a peer is pruned about six seconds after its last message.

Web Locks needs a **secure context**. Serving over plain `http://` on a LAN IP silently disables it;
`localhost` is exempt.

## React StrictMode double-mounts

Handled. The provider recreates its link if a StrictMode cleanup closed it, and `close()` is idempotent.
You may see two `hello` messages in dev — that's expected and harmless.

## Still stuck

Turn on protocol tracing:

```tsx
<DualScreen channel="my-app" debug>
```

Every message in and out is logged with the window's role and short id. Do it in both windows and line
the two logs up — the disagreement is usually obvious.
