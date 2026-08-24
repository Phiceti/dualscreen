# A surface is a route

This is the idea that makes adopting `dualscreen` cheap, so it's worth stating plainly.

## The reframing

In a single-page app, "what is on screen" already **is** a route plus params. Your app knows how to
render `/experiment/EXP-102/volcano?gene=TP53` — that's just a page.

So a second window doesn't need to be a new app. It's the *same* app, at the *same* URL, told to render
a different named surface. The primary window drives it by changing shared state.

That reduces the integration question from *"how do I restructure my state management?"* to *"which of
my existing views goes on the other monitor?"*

## How a window knows what it is

The surface name rides in a query parameter:

```
https://app.example.com/dashboard              → surface "main"
https://app.example.com/dashboard?ds=inspector → surface "inspector"
```

`<DualScreen>` reads it on boot. There is no separate HTML file, no separate bundle, no separate route
table — the same `App` component mounts in both windows and each renders the branch that matches.

Because it's in the URL, it also survives a reload, a bookmark, and a pasted link. You can open a
surface window by hand for debugging just by editing the address bar.

::: tip It composes with your router
The query parameter is the only thing `dualscreen` touches. Your path and hash are left alone, so
`?ds=inspector` works with React Router, TanStack Router, Next's app router, or no router at all.
:::

## Rendering rules

| Window | `<DualScreen.Main>` | `<DualScreen.Surface name="inspector">` |
| --- | --- | --- |
| Primary, inspector closed | renders | renders nothing |
| Primary, inspector in its own window | renders | renders nothing |
| Primary, inspector inline (one display) | renders in a pane | renders in a pane |
| `?ds=inspector` | renders nothing | fills the window |
| `?ds=something-else` | renders nothing | renders nothing |

The important row is the third. On a single display the surface renders **inline, in a resizable split
pane, from the same JSX**. There is no second code path to keep in sync and nothing to test twice.

## Multiple surfaces

Nothing limits you to one:

```tsx
<DualScreen channel="my-app">
  <DualScreen.Main><Workspace /></DualScreen.Main>
  <DualScreen.Surface name="inspector"><Inspector /></DualScreen.Surface>
  <DualScreen.Surface name="timeline"><Timeline /></DualScreen.Surface>
</DualScreen>
```

```tsx
const inspector = useSurface('inspector')
const timeline = useSurface('timeline')
```

Each gets its own window, its own remembered geometry, and its own presence entry. They all share the
same state map.

## Driving a surface's route

For anything richer than "show the selected thing", drive the surface's route directly:

```tsx
const inspector = useSurface('inspector')

inspector.navigate(`/experiment/${id}/volcano`)
```

And in the surface:

```tsx
import { useSurfaceRoute } from 'dualscreen/react'

function Inspector() {
  const route = useSurfaceRoute()   // '/experiment/EXP-102/volcano'
  return <Router location={route} />
}
```

::: info Routes are durable, not fire-and-forget
`navigate()` writes the route into **shared state** rather than emitting a one-shot event. That matters:
a surface window that reloads — or one opened five minutes later — lands on the right route instead of a
blank screen, because the route is part of the snapshot a late joiner receives.

If you genuinely want fire-and-forget, use [commands](/guide/commands) instead.
:::

## Custom roles

You can override the surface name if you don't want it in the URL:

```tsx
<DualScreen channel="my-app" role="inspector">
```

This is mainly useful for tests and for embedding a surface in a context you control. In normal use,
let it read from the URL.
