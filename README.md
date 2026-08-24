<div align="center">

# dualscreen

**Drive a second monitor from your web app.**
Click in one window, change what's shown in another — no server, no Electron, no second entry point.

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-3178c6.svg)](#)
[![size](https://img.shields.io/badge/core-4.8%20kB%20gzip-success.svg)](#package-sizes)
[![deps](https://img.shields.io/badge/runtime%20deps-0-success.svg)](#package-sizes)

[Live demos](#demos) · [Quick start](#quick-start) · [Why](#why-this-exists) · [Browser support](#browser-support) · [API](#api)

</div>

---

## Why this exists

Every field that works on two monitors solved this decades ago in native code — radiology worklists, trading desks, DAWs, IDEs. Web apps never got the plumbing, so people improvise: **open a second tab, drag it to the other monitor, and watch the two go out of sync.**

That behaviour already exists. `dualscreen` just makes the two windows talk.

```tsx
const inspector = useSurface('inspector')

<button onClick={() => inspector.open()}>Open on second screen</button>
```

That's the whole integration. The second window is *your app*, booted at *the same URL*, told to render a different surface.

---

## Quick start

```bash
npm install dualscreen react
```

```tsx
import { DualScreen, useShared, useSurface } from 'dualscreen/react'

function App() {
  return (
    <DualScreen channel="my-app">
      <DualScreen.Main><Workspace /></DualScreen.Main>
      <DualScreen.Surface name="inspector"><Inspector /></DualScreen.Surface>
    </DualScreen>
  )
}

function Workspace() {
  const inspector = useSurface('inspector')
  const [selected, setSelected] = useShared<string | null>('selected', null)

  return (
    <>
      <button onClick={() => inspector.open()}>Open inspector</button>
      {rows.map((row) => (
        <button key={row.id} onClick={() => setSelected(row.id)}>{row.name}</button>
      ))}
    </>
  )
}

function Inspector() {
  const [selected] = useShared<string | null>('selected', null)
  return <Detail id={selected} />
}
```

Both windows run that exact tree. There is no second bundle, no second route table, and no server.

---

## The idea in one paragraph

**A surface is a route.** Your app already knows how to render "the detail view for X" — that is a route plus params. `dualscreen` opens a second window at the same URL with `?ds=inspector`, so the same `<DualScreen.Surface name="inspector">` matches and renders. The primary window then drives it by writing shared state. Nothing about your state management has to change, and the two windows can never drift onto different code, because there is only one tree.

---

## What crosses the wire

**Ids, not payloads.** This is the rule that decides whether a library like this is usable on real data.

```tsx
// ✅ four bytes, regardless of dataset size
setSelected('EXP-102')

// ❌ structured-clones the whole table into every window, on every click
setSelected(rowsForExperiment102)
```

Each window resolves the id against its own cache — React Query, SWR, IndexedDB, whatever you already use. `dualscreen` moves the *selector*; your data layer moves the data. The [linked-brushing demo](#demos) takes this further and ships a brush as a **rectangle in data space** — four numbers — instead of a list of matching ids, so the message size does not grow with the selection.

---

## Browser support

Two different things degrade differently, and conflating them is how libraries in this space oversell themselves.

| Capability | Chrome / Edge | Safari | Firefox |
| --- | :---: | :---: | :---: |
| **Cross-window sync** (the actual value) | ✅ | ✅ | ✅ |
| Presence, leader election, shared state | ✅ | ✅ | ✅ |
| Crash-safe presence (Web Locks) | ✅ | ✅ | ✅ |
| **Automatic placement on monitor 2** | ✅ | ❌ | ❌ |
| Fullscreen on a chosen display | ✅ | ❌ | ❌ |

The [Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) — the thing that puts a window on the right monitor without the user dragging it — is Chromium-only, and has been since it shipped in Chrome 111. We do not paper over that. What we do instead is make sure the part that matters never depends on it.

### The degradation ladder

```
Chromium + permission granted  →  window opens on monitor 2, optionally fullscreen
Chromium + permission denied   →  popup opens; user drags it once
Safari / Firefox               →  popup opens; user drags it once
Single monitor                 →  renders inline as a resizable split pane
```

**Your code does not change between rungs.** `inspector.open()` is the same call; `<DualScreen.Surface>` is the same JSX. The split-pane fallback is not a second code path — it is the same component tree laid out differently.

---

## Demos

```bash
git clone https://github.com/phiceti/dualscreen
cd dualscreen && pnpm install && pnpm build
pnpm --filter dualscreen-playground dev
```

| Demo | Pattern it shows |
| --- | --- |
| **Analysis dashboard** | The work-list pattern — results on one monitor, the selected item large on the other. Route-driving, and ids-not-payloads on a 520-row table. |
| **Presenter mode** | Shared state, **divergent views** — the stage shows the slide, your screen shows notes, a timer, and what's next. The thing mirroring libraries can't express. |
| **Linked brushing** | The 60fps case — `useEphemeral` coalesces onto animation frames, and a **live round-trip readout** measures the latency instead of claiming it. |

Each demo also degrades live: shrink to one monitor and it becomes a split pane in front of you.

---

## API

### Components

| | |
| --- | --- |
| `<DualScreen channel>` | Root provider. One per app. |
| `<DualScreen.Main>` | Renders only in the primary window. |
| `<DualScreen.Surface name>` | Renders when this window *is* that surface — or inline, on one display. |

### Hooks

| | |
| --- | --- |
| `useShared(key, initial?)` | A value replicated to every window. `[value, setValue]`. |
| `useEphemeral(key, initial?)` | Same, but rAF-coalesced and excluded from snapshots. For cursors and hover. |
| `useSurface(name)` | `open()`, `close()`, `navigate()`, `isConnected`, `mode`, … |
| `useSurfaceRoute()` | The route this surface was told to show. |
| `usePeers()` | Every connected window. |
| `useCommand(name, fn)` / `useSend()` | One-off events that have no value worth remembering. |
| `useScreens()` | Display layout, permission state, and the current placement mode. |
| `useIsLeader()` / `useLinkReady()` | Coordination primitives, if you need them. |

### Without React

```ts
import { createLink } from 'dualscreen'

const link = createLink({ channel: 'my-app' })
link.set('selected', 'EXP-102')
link.subscribeKey('selected', (id) => render(id))
```

Full reference: **[the docs site](./docs/)**.

---

## How it works

| Concern | Mechanism | Why this one |
| --- | --- | --- |
| Messaging | `BroadcastChannel` | Same-origin, sub-millisecond, zero infrastructure. Never echoes to the sender. |
| Leader election | **Web Locks** | The browser releases the lock on a *crash*, not just a clean exit — so election is instant with no heartbeat and no timeout to tune. |
| Presence | Web Locks + `locks.query()` | Each window holds a lock named for itself. A crashed tab's lock disappears, so ghost peers are impossible rather than merely unlikely. |
| Conflicts | Last-writer-wins on `(version, origin)` | Every peer derives the *same* answer from the message alone, so the map converges with no server to order writes. |
| Late join | `hello` → leader replies with a snapshot | Exactly one reply, because exactly one leader. |
| Placement | Window Management API | Progressive enhancement — see [the ladder](#the-degradation-ladder). |

Deliberately **not** a CRDT. `dualscreen` targets the shape where one window drives and others follow, and last-writer-wins is the honest fit for that. If you need genuine concurrent editing, put Yjs on top and use `dualscreen` as the transport — the `Transport` interface is public for exactly this.

---

## Packages

`npm install dualscreen` gets everything. Install scoped packages individually if you want a smaller graph.

| Package | Size (min+gzip) | Contents |
| --- | ---: | --- |
| `@dualscreen/core` | 4.8 kB | Transport, protocol, presence, leader election, shared state. No framework. |
| `@dualscreen/screens` | 2.3 kB | Display detection, placement, the degradation ladder. |
| `@dualscreen/react` | 2.9 kB | Hooks and components. |
| `@dualscreen/devtools` | 1.9 kB | Debug overlay. Dev-only. |
| `dualscreen` | — | Meta package re-exporting all four. |

<a id="package-sizes"></a>Full React stack: **~10 kB gzipped, zero third-party runtime dependencies.**

---

## Prior art, and where this differs

| | What it does | What it doesn't |
| --- | --- | --- |
| `broadcast-channel` | Excellent transport + leader election | No screens, no state protocol, no framework layer |
| `redux-state-sync`, cross-tab Zustand middlewares | Mirror one store across tabs | Mirroring is the *wrong model* — two monitors should show **different views of shared state**, not identical state |
| `Yjs` | Conflict-free concurrent editing | Much heavier than controller→viewer needs; no window management |
| `electron-multi-monitor` | Full window control | Requires shipping an Electron app |

The transport layer is genuinely commoditised. What is missing everywhere else is the combination: a state protocol shaped for controller→viewer, window placement with an honest fallback, and framework bindings thin enough that adoption costs an afternoon.

---

## Security

**The trust boundary is the origin, not your application.** `BroadcastChannel` is scoped to an origin,
so any script on the page — analytics, embedded widgets, a compromised dependency — can join a channel
and read or write shared state.

**Put no secrets in shared state or in `meta`**, and treat everything arriving from another window as
untrusted input.

The library refuses `__proto__` / `constructor` / `prototype` as state keys, refuses cross-origin
surface windows, constrains surface names, shape-checks every wire payload, isolates handler
exceptions, and filters executable route schemes — all covered by
[regression tests](./packages/core/test/security.test.ts). It does **not** defend against XSS on your
origin or against semantic abuse using well-formed messages; authorise data access on the server.

Full threat model: [docs/guide/security.md](./docs/guide/security.md) · Reporting:
[SECURITY.md](./SECURITY.md)

## Contributing

```bash
pnpm install
pnpm build        # all packages, in dependency order
pnpm test         # 63 tests: protocol convergence, security regressions, React bindings, demos
pnpm typecheck
```

The protocol tests in [`packages/core/test`](./packages/core/test) are the ones to read first — they cover split-brain convergence, late-join snapshots, and ephemeral exclusion, which is where a library like this actually goes wrong.

## License

[MIT](./LICENSE)
