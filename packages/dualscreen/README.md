# dualscreen

**Drive a second monitor from your web app.** Click in one window, change what's shown in another — no
server, no Electron, no second entry point.

[Documentation](https://phiceti.github.io/dualscreen) · [Live demos](https://phiceti.github.io/dualscreen/demo/) · [GitHub](https://github.com/phiceti/dualscreen)

~10 kB gzipped · zero runtime dependencies · TypeScript types included

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
      <button onClick={() => inspector.open()}>Open on second screen</button>
      <Table selected={selected} onSelect={setSelected} />
    </>
  )
}

function Inspector() {
  const [selected] = useShared<string | null>('selected', null)
  return <Detail id={selected} />
}
```

Both windows run that exact tree. The secondary window is **your app**, booted at the **same URL** with
`?ds=inspector`, so it renders the matching `Surface` and nothing else. No second bundle, no second
route table.

## Entry points

| Import | Contents |
| --- | --- |
| `dualscreen` | Framework-agnostic core. No React dependency. |
| `dualscreen/react` | Hooks and components. |
| `dualscreen/screens` | Display detection and window placement. |
| `dualscreen/devtools` | Debug overlay. Dev-only. |

`react` is an **optional** peer dependency, needed only for the React bindings.

## Ids, not payloads

`BroadcastChannel` uses structured clone, which *copies*. Broadcast the selector, not the data — each
window resolves it against its own cache.

```tsx
setSelected('EXP-102')            // ✅ nine bytes, whatever the dataset size
setSelected(rowsForExperiment)    // ❌ clones the whole table into every window
```

## Browser support

Cross-window synchronisation — the actual value — works in **every** modern browser via
`BroadcastChannel` and Web Locks.

**Automatic placement on a chosen monitor is Chromium-only.** The
[Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) is not
implemented in Safari or Firefox. This project does not paper over that; it confines the damage:

```
Chromium + permission  →  window opens on monitor 2, optionally fullscreen
Safari / Firefox       →  popup opens; the user drags it once
One display            →  renders inline as a resizable split pane
```

**Your code does not change between rungs.** [Full ladder →](https://phiceti.github.io/dualscreen/guide/degradation)

## Security

The trust boundary is the **origin**, not your application: `BroadcastChannel` is origin-scoped, so any
script on the page can join a channel. **Put no secrets in shared state**, and treat everything arriving
from another window as untrusted input. [Threat model →](https://phiceti.github.io/dualscreen/guide/security)

## License

MIT
