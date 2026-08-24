# Changelog

## 0.1.0

Initial release.

- `@dualscreen/core` — BroadcastChannel transport, Web Locks leader election and crash-safe presence,
  last-writer-wins shared state, ephemeral tier, commands, join handshake, protocol tap.
- `@dualscreen/screens` — Window Management API detection, display enumeration, gesture-safe window
  opening, placement, remembered geometry, fullscreen on a chosen display.
- `@dualscreen/react` — `<DualScreen>`, `<DualScreen.Main>`, `<DualScreen.Surface>`, and hooks:
  `useShared`, `useEphemeral`, `useSharedState`, `useSurface`, `useSurfaceRoute`, `usePeers`,
  `useCommand`, `useSend`, `useScreens`, `useIsLeader`, `useLinkReady`.
- `@dualscreen/devtools` — peers, shared state, and live protocol traffic in a floating panel.
- `dualscreen` — meta package re-exporting all four.

Security hardening in this release:

- `__proto__`, `constructor`, and `prototype` are refused as shared-state keys, on both local writes
  and remote patches. A prototype write is invisible to `Object.keys()` and to the devtools panel,
  which made it a particularly poor failure mode.
- Cross-origin surface windows are refused before `window.open` is reached — an opener handle across
  origins enables reverse tabnabbing, and a cross-origin window could never join the channel anyway.
- Surface names are constrained to `[A-Za-z0-9_-]{1,64}`; an unrecognised `?ds=` value falls back to
  the primary window.
- Every wire payload is shape-checked, snapshot peer lists are capped, and handler exceptions are
  isolated so one malformed message cannot wedge the link.
- Routes read from shared state are filtered for executable schemes (`javascript:` and friends,
  including control-character obfuscations).

See [Security](/guide/security) for the full trust model.

Known limitations:

- Automatic window placement requires the Window Management API and is therefore Chromium-only.
  Everything else works in any browser with `BroadcastChannel`.
- Same-origin, same-browser only. Cross-device needs a custom
  [transport](/guide/transports).
- Shared state is last-writer-wins, not conflict-free. Concurrent editing of one structure needs a CRDT
  layered on top.
- The trust boundary is the **origin**, not the application: any script on the page can join a channel.
  Do not put secrets in shared state. See [Security](/guide/security).
