---
layout: page
title: dualscreen — drive a second monitor from your web app
description: Click in one window, change what's shown in another. ~10 kB, zero runtime dependencies, no server.
---

<div class="ds-home">

<div class="ds-hero">
<div>

<h1>Drive a <em>second monitor</em> from your web app.</h1>

<p class="sub">Click in one window, change what's shown in another. No server, no Electron, no second entry point — the other window is your app, at the same URL, rendering a different surface.</p>

<div class="ds-badges">
  <span class="ds-chip"><b>~10 kB</b> gzipped</span>
  <span class="ds-chip"><b>0</b> runtime deps</span>
  <span class="ds-chip">TypeScript</span>
  <span class="ds-chip">React 18 · 19</span>
  <span class="ds-chip">MIT</span>
</div>

<div class="ds-install">
  <span class="prompt">$</span><b>npm install dualscreen</b>
</div>

<div class="ds-cta">
  <a class="ds-btn ds-btn-primary" href="guide/">Get started →</a>
  <a class="ds-btn ds-btn-ghost" href="#demos">See it working</a>
  <a class="ds-btn ds-btn-ghost" href="https://github.com/phiceti/dualscreen">GitHub</a>
</div>

</div>

<figure class="ds-figure">
<svg viewBox="0 0 520 286" role="img" aria-label="A table on the left monitor drives a chart on the right monitor; only an id crosses between them.">
  <!-- left monitor -->
  <rect x="8" y="20" width="212" height="146" rx="8" fill="var(--ds-panel-2)" stroke="var(--ds-border-strong)" stroke-width="2"/>
  <rect x="8" y="20" width="212" height="22" rx="8" fill="var(--ds-border)"/>
  <rect x="8" y="34" width="212" height="8" fill="var(--ds-border)"/>
  <g fill="var(--ds-border-strong)">
    <rect x="22" y="54" width="184" height="9" rx="2.5"/>
    <rect x="22" y="86" width="184" height="9" rx="2.5"/>
    <rect x="22" y="102" width="184" height="9" rx="2.5"/>
    <rect x="22" y="134" width="184" height="9" rx="2.5"/>
  </g>
  <rect x="18" y="66" width="192" height="14" rx="3" fill="var(--ds-accent)" opacity="0.16"/>
  <rect x="18" y="66" width="3" height="14" rx="1.5" fill="var(--ds-accent)"/>
  <rect x="30" y="69" width="120" height="8" rx="2.5" fill="var(--ds-accent)"/>
  <path d="M96 178v10" stroke="var(--ds-border-strong)" stroke-width="6"/>
  <rect x="66" y="188" width="94" height="7" rx="3.5" fill="var(--ds-border-strong)"/>

  <!-- right monitor -->
  <rect x="300" y="20" width="212" height="146" rx="8" fill="var(--ds-panel-2)" stroke="var(--ds-accent)" stroke-width="2"/>
  <rect x="300" y="20" width="212" height="22" rx="8" fill="var(--ds-accent)" opacity="0.18"/>
  <rect x="300" y="34" width="212" height="8" fill="var(--ds-accent)" opacity="0.18"/>
  <g fill="var(--ds-border-strong)" opacity="0.55">
    <circle cx="340" cy="132" r="3"/><circle cx="356" cy="120" r="3"/><circle cx="372" cy="128" r="3"/>
    <circle cx="392" cy="112" r="3"/><circle cx="410" cy="126" r="3"/><circle cx="430" cy="118" r="3"/>
    <circle cx="452" cy="130" r="3"/><circle cx="470" cy="122" r="3"/><circle cx="486" cy="134" r="3"/>
    <circle cx="348" cy="106" r="3"/><circle cx="418" cy="100" r="3"/><circle cx="464" cy="108" r="3"/>
  </g>
  <circle cx="404" cy="74" r="5.5" fill="var(--ds-accent)"/>
  <circle cx="404" cy="74" r="10" fill="none" stroke="var(--ds-accent)" stroke-width="2"/>
  <circle cx="372" cy="86" r="4" fill="var(--ds-pole-up)" opacity="0.8"/>
  <circle cx="446" cy="88" r="4" fill="var(--ds-pole-up)" opacity="0.8"/>
  <circle cx="352" cy="94" r="4" fill="var(--ds-accent)" opacity="0.65"/>
  <circle cx="470" cy="94" r="4" fill="var(--ds-pole-up)" opacity="0.65"/>
  <path d="M388 178v10" stroke="var(--ds-border-strong)" stroke-width="6"/>
  <rect x="358" y="188" width="94" height="7" rx="3.5" fill="var(--ds-border-strong)"/>

  <!-- wire -->
  <path d="M226 93h62" stroke="var(--ds-accent)" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="m282 87 8 6-8 6" fill="none" stroke="var(--ds-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="196" y="222" width="128" height="26" rx="6" fill="var(--ds-accent)" opacity="0.12"/>
  <text x="260" y="239" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12.5" fill="var(--ds-accent)" font-weight="600">'EXP-102'</text>
  <text x="260" y="268" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11.5" fill="var(--ds-ink-3)">9 bytes — not the 520 rows</text>
</svg>
<figcaption>One window drives. Only the selector crosses; each side resolves it against its own cache.</figcaption>
</figure>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="problem">

<p class="ds-eyebrow">The gap</p>

## Everyone already works this way. The web just can't.

<p class="lede">Radiology worklists, trading desks, DAWs, IDEs — every field that works on two monitors solved this decades ago in native code. Web apps never got the plumbing, so people improvise:</p>

<div class="ds-grid ds-grid-3">
<div class="ds-card">
<span class="ds-num">01</span>

### Open a second tab

Duplicate the app, because there's no other way to get a second view on screen.

</div>
<div class="ds-card">
<span class="ds-num">02</span>

### Drag it to the other monitor

Manually, every session. Nothing remembers where it went.

</div>
<div class="ds-card" style="border-color: var(--ds-pole-up);">
<span class="ds-num" style="color: var(--ds-pole-up);">03</span>

### Watch them drift apart

Two independent apps that share nothing. **This is the gap** — steps 1 and 2 already prove the demand.

</div>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="try">

<p class="ds-eyebrow">Try it here</p>

## A working demo, in this page

<p class="lede">This is the real playground running in an iframe, pinned to split mode so both surfaces fit. Click a row and the inspector follows. On two monitors, that right-hand pane is a separate window on your second screen — same component, same state, no code change.</p>

<div class="ds-embed">
  <div class="ds-embed-bar">
    <span class="dots"><i></i><i></i><i></i></span>
    <span>dualscreen playground — analysis dashboard</span>
  </div>
  <iframe src="demo/?embed=1#/analysis" title="dualscreen analysis dashboard demo" loading="lazy"></iframe>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="install">

<p class="ds-eyebrow">Install</p>

## One package, four entry points

<div class="ds-grid ds-grid-2">
<div>

```bash
npm install dualscreen
# pnpm add dualscreen
# yarn add dualscreen
# bun add dualscreen
```

`react` is an **optional** peer dependency — needed only for the React bindings. The core is framework-agnostic and ships no React code.

</div>
<div>

| Import | Contents |
| --- | --- |
| `dualscreen` | Core. No framework. |
| `dualscreen/react` | Hooks + components |
| `dualscreen/screens` | Displays + placement |
| `dualscreen/devtools` | Debug overlay |

</div>
</div>

<p style="margin-top:24px"></p>

Prefer smaller graphs? Install the scoped packages individually.

<div class="ds-table-wrap">

| Package | min+gzip | Contents |
| --- | ---: | --- |
| `@dualscreen/core` | **4.8 kB** | Protocol, transport, presence, leader election, shared state |
| `@dualscreen/screens` | **2.3 kB** | Display detection, placement, the degradation ladder |
| `@dualscreen/react` | **2.9 kB** | `<DualScreen>` and 11 hooks |
| `@dualscreen/devtools` | **1.9 kB** | Peers, state, and live protocol traffic |

</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="implementation">

<p class="ds-eyebrow">Implementation</p>

## The whole integration, in four steps

<p class="lede">There is no second bundle to build, no second route table to maintain, and nothing to deploy. Both windows run the same component tree.</p>

<div class="ds-steps">

<div class="ds-step">
<div>

### Wrap your app

`channel` namespaces your app so two apps on one origin never collide.

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

</div>
</div>

<div class="ds-step">
<div>

### Declare where things render

`Main` renders only in the primary window. `Surface` renders when this window **is** that surface — or inline beside `Main` when there's only one display.

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

</div>
</div>

<div class="ds-step">
<div>

### Share the selection

`useShared` works identically in both windows. Whoever writes, everyone sees it.

```tsx
import { useShared } from 'dualscreen/react'

function ExperimentTable() {
  const [selected, setSelected] = useShared<string | null>('selected', null)

  return rows.map((row) => (
    <tr key={row.id}
        aria-selected={row.id === selected}
        onClick={() => setSelected(row.id)}>
      <td>{row.name}</td>
    </tr>
  ))
}

function ExperimentDetail() {
  const [selected] = useShared<string | null>('selected', null)
  // Resolve the id against your own cache — React Query, SWR, anything.
  const { data } = useQuery({ queryKey: ['row', selected], queryFn: fetchRow })
  return <Detail data={data} />
}
```

</div>
</div>

<div class="ds-step">
<div>

### Open the window

Call `open()` **directly in the click handler** — popup blockers reject windows opened outside a user gesture, and awaiting anything first is enough to lose it.

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

</div>
</div>

</div>

<p style="margin-top:28px"></p>

<a class="ds-btn ds-btn-ghost" href="guide/first-surface">Full walkthrough →</a>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="idea">

<p class="ds-eyebrow">The core idea</p>

## A surface is a route

<p class="lede">This is the reframing that makes adoption cheap. In a single-page app, "what's on screen" already <em>is</em> a route plus params — so a second window doesn't need to be a new app. It's the same app, at the same URL, told to render a different named surface.</p>

<div class="ds-grid ds-grid-2">
<div class="ds-card">

### How a window knows what it is

The surface name rides in a query parameter:

```
/dashboard              → surface "main"
/dashboard?ds=inspector → surface "inspector"
```

Because it's in the URL, it survives a reload, a bookmark, and a pasted link. You can open a surface by hand from the address bar to debug it.

</div>
<div class="ds-card">

### Why that matters

The integration question stops being *"how do I restructure my state management?"* and becomes *"which of my existing views goes on the other monitor?"*

Only the query string is touched, so it composes with React Router, TanStack Router, Next's app router, or no router at all.

</div>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="payloads">

<p class="ds-eyebrow">The rule that matters</p>

## Ids, not payloads

<p class="lede"><code>BroadcastChannel</code> uses structured clone, which <em>copies</em>. Broadcasting a 200 MB matrix doesn't pass a reference — it serialises and deserialises the whole thing into every connected window, blocking the main thread on both ends. This is the single rule that decides whether a cross-window library survives contact with real data.</p>

<div class="ds-compare">
<div>

<p class="ds-verdict good">✓ Nine bytes, whatever the dataset size</p>

```tsx
setSelected('EXP-102')
```

</div>
<div>

<p class="ds-verdict bad">✗ Clones the whole table, on every click</p>

```tsx
setSelected(rowsForExperiment102)
```

</div>
</div>

<p style="margin-top:20px"></p>

The rule generalises: **send the smallest thing that describes the selection.** The linked-brushing demo ships a brush over 400 points as a rectangle in data space — four numbers — so cost never grows with the selection, and the receiving window can apply it to entirely different axes.

<a class="ds-btn ds-btn-ghost" href="guide/ids-not-payloads">Read more →</a>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="features">

<p class="ds-eyebrow">What you get</p>

## Built for the parts that actually go wrong

<div class="ds-grid ds-grid-3">

<div class="ds-card">

### Crash-safe presence

Built on **Web Locks**, so a force-quit window disappears immediately. No heartbeat interval, no timeout that's wrong on somebody's machine.

</div>

<div class="ds-card">

### State that converges

Last-writer-wins on `(version, origin)`. Every peer derives the same answer from the message alone, so the map converges with no server ordering writes.

</div>

<div class="ds-card">

### An ephemeral tier

`useEphemeral` coalesces onto animation frames — a 60 fps pointer stream can't flood the channel — and is excluded from late-join snapshots.

</div>

<div class="ds-card">

### Durable routes

`navigate()` writes to shared state, not a one-shot event. A surface that reloads lands back where it was instead of on a blank screen.

</div>

<div class="ds-card">

### Gesture-safe opening

`window.open()` runs synchronously before any `await`, then placement resolves. Get that order wrong and the popup is blocked every time.

</div>

<div class="ds-card">

### Devtools included

Peers, shared state, and live protocol traffic in a floating panel. Render it in both windows and the disagreement is usually obvious.

</div>

</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="demos">

<p class="ds-eyebrow">Demos</p>

## Three patterns, running live

<p class="lede">Each opens the full playground. Every one degrades in front of you — shrink to one monitor and it becomes a split pane.</p>

<div class="ds-grid ds-grid-3">

<a class="ds-card" href="demo/#/analysis" target="_blank" rel="noreferrer">
  <h3>Analysis dashboard</h3>
  <p>The work-list pattern. Results on one monitor, the selected item large on the other — route-driving and ids-not-payloads over a 520-row differential expression table.</p>
  <span class="ds-more">Open demo →</span>
</a>

<a class="ds-card" href="demo/#/presenter" target="_blank" rel="noreferrer">
  <h3>Presenter mode</h3>
  <p>Shared state, <strong>divergent views</strong>. The stage shows the slide; your screen shows notes, a timer, and what&rsquo;s next — the thing mirroring libraries cannot express.</p>
  <span class="ds-more">Open demo →</span>
</a>

<a class="ds-card" href="demo/#/brushing" target="_blank" rel="noreferrer">
  <h3>Linked brushing</h3>
  <p>The 60 fps case. Hover either plot and a crosshair tracks the same cell in the other window, with a <strong>live round-trip readout</strong> that measures latency instead of claiming it.</p>
  <span class="ds-more">Open demo →</span>
</a>

</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="api">

<p class="ds-eyebrow">API</p>

## The whole surface, on one screen

<div class="ds-grid ds-grid-2">
<div>

### Components

<div class="ds-table-wrap">

| | |
| --- | --- |
| `<DualScreen channel>` | Root provider. One per app. |
| `<DualScreen.Main>` | Renders only in the primary window. |
| `<DualScreen.Surface name>` | Renders when this window *is* that surface — or inline, on one display. |

</div>

### Without React

```ts
import { createLink } from 'dualscreen'

const link = createLink({ channel: 'my-app' })

link.set('selected', 'EXP-102')
link.subscribeKey('selected', (id) => render(id))
link.send('rerun', { force: true })
link.command('rerun', (args, from) => rerun(args))

await link.whenReady()
link.close()
```

</div>
<div>

### Hooks

<div class="ds-table-wrap">

| | |
| --- | --- |
| `useShared(key, initial?)` | A value replicated to every window. |
| `useEphemeral(key, initial?)` | rAF-coalesced, excluded from snapshots. |
| `useSurface(name)` | `open`, `close`, `navigate`, `isConnected`, `mode` |
| `useSurfaceRoute()` | The route this surface was told to show. |
| `usePeers()` | Every connected window. |
| `useCommand(name, fn)` | Handle a one-off event. |
| `useSend()` | Send one. |
| `useScreens()` | Layout, permission, placement mode. |
| `useSharedState()` | Every shared value at once. |
| `useIsLeader()` | Whether this window leads. |
| `useLinkReady()` | Whether the handshake settled. |
| `useDualScreen()` | Escape hatch to the `Link`. |

</div>
</div>
</div>

<p style="margin-top:28px"></p>

<div class="ds-cta">
  <a class="ds-btn ds-btn-primary" href="api/react">React reference →</a>
  <a class="ds-btn ds-btn-ghost" href="api/core">Core reference</a>
  <a class="ds-btn ds-btn-ghost" href="api/screens">Screens reference</a>
  <a class="ds-btn ds-btn-ghost" href="api/devtools">Devtools</a>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="support">

<p class="ds-eyebrow">Browser support</p>

## An honest account

<p class="lede">Two different things degrade differently, and conflating them is how libraries in this space oversell themselves. The API that places a window on a chosen monitor is <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API">Window Management</a>, and it is <strong>Chromium-only</strong>. We don't paper over that — we confine the damage.</p>

<div class="ds-table-wrap">

| Capability | Chrome / Edge | Safari | Firefox |
| --- | :---: | :---: | :---: |
| **Cross-window sync** — the actual value | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> |
| Shared state, presence, commands | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> |
| Crash-safe presence &amp; leader election | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> |
| Split-pane fallback | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> |
| Opening a secondary window | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> | <span class="ds-yes">✓</span> |
| **Automatic placement on a chosen display** | <span class="ds-yes">✓</span> | <span class="ds-no">✗</span> | <span class="ds-no">✗</span> |
| Fullscreen on a chosen display | <span class="ds-yes">✓</span> | <span class="ds-no">✗</span> | <span class="ds-no">✗</span> |

</div>

<h3 style="margin-top:34px">The degradation ladder</h3>

<p class="lede" style="margin-bottom:18px">Your code does not change between rungs. <code>open()</code> is the same call; <code>&lt;DualScreen.Surface&gt;</code> is the same JSX.</p>

<div class="ds-ladder">
  <div class="ds-rung">
    <span><strong>Chromium, permission granted, second display</strong>Window opens on monitor 2, sized to it, optionally fullscreen.</span>
    <code>auto</code>
  </div>
  <div class="ds-rung">
    <span><strong>Chromium, permission denied</strong>Popup opens; the user drags it once. Position is remembered.</span>
    <code>manual</code>
  </div>
  <div class="ds-rung">
    <span><strong>Safari / Firefox</strong>Popup opens; the user drags it once. Sync is completely unaffected.</span>
    <code>manual</code>
  </div>
  <div class="ds-rung">
    <span><strong>One display</strong>Renders inline as a resizable split pane — the same component tree, laid out differently.</span>
    <code>split</code>
  </div>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="compare">

<p class="ds-eyebrow">Prior art</p>

## Where this differs

<p class="lede">The transport layer is genuinely commoditised — <code>BroadcastChannel</code> has been baseline for years. What was missing everywhere else is the combination.</p>

<div class="ds-table-wrap">

| | What it does well | What it doesn't |
| --- | --- | --- |
| `broadcast-channel` | Excellent transport and leader election | No screens, no state protocol, no framework layer |
| `redux-state-sync`, cross-tab Zustand | Mirror one store across tabs | Mirroring is the **wrong model** — two monitors should show *different views of shared state*, not identical state |
| `Yjs` | Conflict-free concurrent editing | Far heavier than controller→viewer needs; no window management |
| `electron-multi-monitor` | Complete window control | Requires shipping an Electron app |

</div>

<p style="margin-top:22px"></p>

**Deliberately not a CRDT.** `dualscreen` targets the shape where one window drives and the others follow, and last-writer-wins is the honest fit. If you need genuine concurrent editing, put Yjs on top and use `dualscreen` as the transport — the `Transport` interface is public for exactly that.

</div>

<!-- ===================================================================== -->
<div class="ds-section" id="security">

<p class="ds-eyebrow">Security</p>

## The trust boundary is the origin

<p class="lede"><code>BroadcastChannel</code> is scoped to an origin, not to your app. Any script on the page — an analytics tag, an embedded widget, a compromised dependency — can join a channel and read or write shared state. The data was always reachable; what changes is how convenient it is to collect. So put no secrets in shared state, and treat everything arriving from another window as untrusted input.</p>

<div class="ds-grid ds-grid-2">
<div class="ds-card">

### Hardened where it counts

`__proto__`, `constructor`, and `prototype` are refused as state keys — a prototype write would be
invisible to `Object.keys()` *and* to the devtools panel. Cross-origin surface windows are refused
before `window.open` is reached, since an opener handle across origins enables reverse tabnabbing.
Every wire payload is shape-checked, and handler exceptions are isolated so one malformed message
cannot wedge the link.

</div>
<div class="ds-card">

### Honest about the limits

Shape validation is not authorisation. A peer can legitimately set `selectedExperiment` to any id —
whether the user may *see* it is your server's question, not the channel's. And if an attacker can run
script on your origin, they already have your session; dualscreen neither helps nor hinders there.

<a class="ds-more" href="guide/security">Read the threat model →</a>

</div>
</div>

</div>

<!-- ===================================================================== -->
<div class="ds-final">

## Ship it this afternoon

<p>If your app already has routes, it already has most of this. The integration is a provider, two components, and one hook.</p>

<div class="ds-cta">
  <a class="ds-btn ds-btn-primary" href="guide/">Read the guide →</a>
  <a class="ds-btn ds-btn-ghost" href="demo/" target="_blank" rel="noreferrer">Open the demos</a>
  <a class="ds-btn ds-btn-ghost" href="https://github.com/phiceti/dualscreen">Star on GitHub</a>
</div>

</div>

</div>
