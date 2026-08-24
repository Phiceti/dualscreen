# @dualscreen/core

Framework-agnostic core for [dualscreen](https://phiceti.github.io/dualscreen) — cross-window coordination with no server and no
framework dependency.

Most apps should install [`dualscreen`](https://www.npmjs.com/package/dualscreen) instead, which
re-exports this plus the React bindings, display handling, and devtools.

[Documentation](https://phiceti.github.io/dualscreen/api/core) · [GitHub](https://github.com/phiceti/dualscreen)

```bash
npm install @dualscreen/core
```

```ts
import { createLink } from '@dualscreen/core'

const link = createLink({ channel: 'my-app' })

link.set('selected', 'EXP-102')
link.subscribeKey('selected', (id) => render(id))

link.send('rerun', { force: true })
link.command('rerun', (args, from) => rerun(args))

await link.whenReady()
```

## What's in here

- **Transport** — `BroadcastChannel` by default; the `Transport` interface is public so you can route
  over a WebSocket, a Service Worker, or a test double.
- **Leader election** — built on **Web Locks**, so the browser releases leadership on a *crash*, not just
  a clean exit. No heartbeat, no timeout to tune.
- **Presence** — each window holds a lock named for itself, so a force-quit window is provably gone
  rather than a ghost awaiting a timeout.
- **Shared state** — last-writer-wins on `(version, origin)`, so every peer derives the same answer with
  no server ordering writes. Deliberately not a CRDT.
- **Ephemeral tier** — values excluded from late-join snapshots, for cursors and hover.
- **Commands** — one-off events that no late-joining window should replay.

[API reference →](https://phiceti.github.io/dualscreen/api/core)

## License

MIT
