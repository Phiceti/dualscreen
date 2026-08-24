# Your first surface

We'll build the work-list pattern: a table on one monitor, a detail view on the other.

## 1. Wrap your app

```tsx
import { DualScreen } from 'dualscreen/react'

export function App() {
  return (
    <DualScreen channel="my-app">
      {/* everything else */}
    </DualScreen>
  )
}
```

`channel` namespaces your app. Windows only talk to windows on the same channel, so two different apps
on one origin never collide. Pick something stable and specific.

## 2. Declare where things render

```tsx
<DualScreen channel="my-app">
  <DualScreen.Main>
    <ExperimentTable />
  </DualScreen.Main>

  <DualScreen.Surface name="inspector">
    <ExperimentDetail />
  </DualScreen.Surface>
</DualScreen>
```

- `<DualScreen.Main>` renders **only in the primary window**.
- `<DualScreen.Surface name="inspector">` renders **only in a window that is the inspector** — or
  inline beside `Main` when there is just one display.

Both windows run this same tree. The secondary window boots at the same URL with `?ds=inspector`, so it
matches the `Surface` and renders nothing else.

## 3. Share the selection

```tsx
import { useShared } from 'dualscreen/react'

function ExperimentTable() {
  const [selected, setSelected] = useShared<string | null>('selected', null)

  return (
    <table>
      {rows.map((row) => (
        <tr key={row.id}
            aria-selected={row.id === selected}
            onClick={() => setSelected(row.id)}>
          <td>{row.name}</td>
        </tr>
      ))}
    </table>
  )
}

function ExperimentDetail() {
  const [selected] = useShared<string | null>('selected', null)
  if (!selected) return <Empty />
  return <Detail id={selected} />
}
```

`useShared` works identically in both windows. Whoever writes, everyone sees it.

::: tip Share the id, not the row
`setSelected(row.id)` — never `setSelected(row)`. See [Ids, not payloads](/guide/ids-not-payloads) for
why this is the difference between a library that works on real data and one that doesn't.
:::

## 4. Open the window

```tsx
import { useSurface } from 'dualscreen/react'

function Toolbar() {
  const inspector = useSurface('inspector')

  return (
    <button onClick={() => inspector.open()}>
      {inspector.isConnected ? 'Inspector open' : 'Open on second screen'}
    </button>
  )
}
```

::: warning Call `open()` inside the click handler
Popup blockers reject `window.open()` outside a user gesture, and `await`ing anything first is enough to
lose it. `inspector.open()` is written so its `window.open()` call happens synchronously *before* any
`await` — but that only holds if *you* call it directly from the handler too.

```tsx
// ✅
onClick={() => inspector.open()}

// ❌ the gesture is gone by the time open() runs
onClick={async () => { await loadSomething(); inspector.open() }}
```
:::

## 5. Add the devtools

```tsx
import { DualScreenDevtools } from 'dualscreen/devtools'

<DualScreen channel="my-app">
  {/* … */}
  {import.meta.env.DEV && <DualScreenDevtools />}
</DualScreen>
```

Render it in **both** windows. Debugging two windows is genuinely harder than debugging one — you can't
watch both consoles at once, and the interesting failures are the ones where the windows disagree.
Having the panel side by side is usually enough to see the problem immediately.

## That's the whole integration

You now have a second window that follows the first, degrades to a split pane on one monitor, survives
a reload on either side, and never ships more than an id over the wire.

Next: [A surface is a route](/guide/surfaces).
