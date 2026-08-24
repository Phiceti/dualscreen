# What it does

`dualscreen` lets one browser window control what another browser window shows — typically on a second
monitor — with no server, no Electron, and no second entry point to build.

## The problem

Analysis tools, dashboards, clinical viewers, and trading interfaces all share a shape: a **list of
things** and a **detailed view of one thing**. On two monitors that shape is obvious — worklist left,
image right — and native applications have laid it out that way for decades.

Web apps can't. Not because the browser forbids it, but because nothing connects the two windows. So
users improvise:

1. Open a second tab.
2. Drag it to the other monitor.
3. Discover the two are completely independent apps that share nothing.

Step 3 is the gap. The demand is already demonstrated by steps 1 and 2.

## The shape of the solution

The problem decomposes into three parts, and conflating them is why no good package existed:

| Layer | Status before this project |
| --- | --- |
| Place a window on a specific monitor | Solved in Chromium, unsolved elsewhere |
| Move messages between windows | Fully solved, natively, everywhere |
| Model app state so a second view is meaningful | **Unsolved — this is the actual work** |

Anyone framing this as "a messaging library" is building the easy third. `BroadcastChannel` has been
baseline for years and is genuinely a non-problem.

## What dualscreen actually gives you

- **A surface model** — the second window is your app at the same URL rendering a different named
  surface. [Read more →](/guide/surfaces)
- **Shared state that converges** — last-writer-wins on `(version, origin)`, so every window derives the
  same answer with no server ordering writes. [Read more →](/guide/shared-state)
- **Presence that is crash-safe** — built on Web Locks, so a force-quit window disappears immediately
  rather than lingering as a ghost until a heartbeat times out.
- **Window placement with an honest fallback** — automatic on Chromium, a draggable popup elsewhere, a
  split pane on one display, all from the same code. [Read more →](/guide/degradation)
- **An ephemeral tier** — for cursors and hover, rAF-coalesced and excluded from late-join snapshots.

## What it deliberately is not

**It is not a CRDT.** `dualscreen` targets the shape where one window drives and the others follow, and
last-writer-wins is the honest fit. If two windows must edit the same structure concurrently and both
edits have to survive, use Yjs and put `dualscreen` underneath as the transport — the `Transport`
interface is public for exactly that.

**It is not a state-mirroring library.** Mirroring assumes both windows want to look the same. The
whole point of a second monitor is that they *don't* — the stage shows the slide, your screen shows the
notes. See the [presenter pattern](/guide/patterns#presenter-mode).

**It is not cross-device.** v1 is same-origin, same-browser, same machine. Phone-as-remote and
laptop-drives-conference-display need a relay server and an auth story; the transport interface is
designed so that can be added without an API break. [Read more →](/guide/transports)

## Next

- [Installation](/guide/installation)
- [Your first surface](/guide/first-surface)
