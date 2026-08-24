# Patterns

Four shapes that cover most real uses. All three demos in the repo are runnable versions of these.

## The work list

*A list of things on one monitor, the selected thing rendered large on the other.*

The canonical case — radiology worklists, experiment tables, ticket queues, search results.

```tsx
function Table() {
  const inspector = useSurface('inspector')
  const [selected, setSelected] = useShared<string | null>('selected', null)

  return rows.map((row) => (
    <tr key={row.id}
        aria-selected={row.id === selected}
        onClick={() => {
          setSelected(row.id)
          inspector.navigate(`/detail/${row.id}`)
        }}>
      <td>{row.name}</td>
    </tr>
  ))
}

function Inspector() {
  const [selected] = useShared<string | null>('selected', null)
  const { data } = useQuery({ queryKey: ['row', selected], queryFn: () => fetchRow(selected) })
  return <Detail data={data} />
}
```

Key points: only the id crosses; the inspector fetches through its own cache; `navigate()` makes the
route durable across reloads.

## Presenter mode

*One shared value, two completely different interfaces.*

```tsx
function Presenter() {
  const [index, setIndex] = useShared('slideIndex', 0)
  return (
    <>
      <Timer />
      <Notes text={SLIDES[index].notes} />
      <NextUp slide={SLIDES[index + 1]} />
      <button onClick={() => setIndex((i) => i + 1)}>Next</button>
    </>
  )
}

function Stage() {
  const [index] = useShared('slideIndex', 0)
  return <Slide data={SLIDES[index]} />
}
```

This is the pattern that state-mirroring libraries cannot express. The windows are **not** showing the
same thing, and they shouldn't be — that divergence is the entire value. The timer and notes never reach
the stage.

## Linked brushing

*High-frequency ephemeral state, coalesced.*

```tsx
const [hovered, setHovered] = useEphemeral<number | null>('hovered', null)
const [brush, setBrush] = useShared<BrushRect | null>('brush', null)

<Scatter onHover={setHovered} onBrush={setBrush} />
```

`useEphemeral` caps you at one message per animation frame no matter how fast pointer events arrive, and
keeps the value out of late-join snapshots. The brush travels as a rectangle in **data space** — four
numbers — so the cost doesn't grow with the selection, and the receiving window can apply it to entirely
different axes.

## Detached panel

*Move an existing panel out of a crowded layout.*

The lowest-effort adoption path: take a panel you already have and let users pop it out.

```tsx
function Layout() {
  const panel = useSurface('panel')
  return (
    <>
      <Editor />
      {!panel.isConnected && <Preview />}   {/* hide locally when detached */}
      <button onClick={() => panel.open()}>Detach preview</button>
    </>
  )
}

<DualScreen.Surface name="panel"><Preview /></DualScreen.Surface>
```

`<Preview>` is the same component in both places. Note the `!panel.isConnected` guard — without it the
preview renders twice, which is occasionally what you want and usually isn't.

---

## Anti-patterns

**Broadcasting rows instead of ids.** See [Ids, not payloads](/guide/ids-not-payloads). This is the one
that makes an app unusable on real data.

**Using shared state for one-off events.** "Re-run analysis" as a boolean you flip is a bug waiting to
happen — a window opening later will replay it. Use a [command](/guide/commands).

**Awaiting before `open()`.** Loses the user gesture; the popup gets blocked. See
[the gesture rule](/guide/placement#the-gesture-rule).

**Assuming the surface window exists.** Users close windows. Always branch on `isConnected` rather than
assuming a surface you opened is still there.

**Putting a value in shared state that only one window cares about.** It costs a message to every window
and clutters the snapshot. Local state is still fine — most of your state should stay local.
