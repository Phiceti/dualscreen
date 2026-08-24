# Browser support

Two different things degrade differently, and conflating them is how libraries in this space oversell
themselves.

## The table

| Capability | Chrome / Edge | Safari | Firefox |
| --- | :---: | :---: | :---: |
| **Cross-window sync** — the actual value | ✅ | ✅ | ✅ |
| Shared state, presence, commands | ✅ | ✅ | ✅ |
| Crash-safe presence & leader election (Web Locks) | ✅ | ✅ | ✅ |
| Split-pane fallback | ✅ | ✅ | ✅ |
| Opening a secondary window | ✅ | ✅ | ✅ |
| **Automatic placement on a chosen display** | ✅ | ❌ | ❌ |
| Fullscreen on a chosen display | ✅ | ❌ | ❌ |
| Reading the full display layout | ✅ | ❌ | ❌ |
| Detecting *that* a second display exists | ✅ | ❌ | ❌ |

## The Chromium-only part

The [Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) —
`window.getScreenDetails()`, `screen.isExtended`, and the `window-management` permission — is what makes
a window land on the second monitor without the user dragging it.

It shipped in **Chrome and Edge 111** (March 2023). Firefox and Safari have not implemented it, and as
of this writing that has not changed. It is still classified as limited availability, not Baseline.

This is a genuine constraint, and it's the single biggest limitation of the project. `dualscreen` does
not paper over it. What it does is confine the damage: **only the convenience of automatic placement is
gated.** Synchronisation is built on `BroadcastChannel` and Web Locks, which are available everywhere,
so the part that actually matters works in every modern browser.

## Underlying APIs

| API | Used for | Fallback if missing |
| --- | --- | --- |
| `BroadcastChannel` | Messaging | In-process transport (single window only) |
| Web Locks | Leader election | Oldest-peer-wins from the presence list |
| Web Locks `query()` | Crash-safe presence | Last-seen timestamps refreshed by pings |
| Window Management | Placement, display info | Popup the user drags; split pane on one display |
| Fullscreen `screen` option | Fullscreen on a target display | Ordinary fullscreen on the current display |
| `localStorage` | Remembered geometry | Not remembered |

Every one is feature-detected. Nothing throws when an API is absent.

## Requirements

- **Secure context.** Web Locks and Window Management require HTTPS or `localhost`.
- **Same origin.** Windows must share an origin to be on the same channel. This is also why the
  secondary window inherits your session for free.
- **Same browser profile.** A Chrome window and a Firefox window will not see each other. For that you
  need a [relay transport](/guide/transports).

## What about a browser extension?

An extension could place windows anywhere in any browser, using `chrome.windows.create`. It's the
escape hatch if the Chromium limit is fatal for your use case — but it trades a zero-friction `npm
install` for an installation step every user has to complete, which is a much larger ask. It's out of
scope here.
