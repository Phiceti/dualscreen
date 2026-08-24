# Security

The one thing to internalise: **the trust boundary is the origin, not your application.**

## The trust model

`BroadcastChannel` is scoped to an origin. It is not scoped to your app, your
bundle, or your React tree. Any script executing on the page can open a channel by name and
participate as a full peer — read every shared value, write any key, impersonate a surface.

That includes code you did not write:

- an analytics or tag-manager script
- an A/B testing or session-replay snippet
- an advertising or support-widget embed
- a compromised npm dependency anywhere in your bundle
- a browser extension with content-script access

Before dualscreen, such a script had to actively hunt for your application state. After, there is a
named, well-documented channel publishing a live stream of it. **The data was always reachable; what
changes is how convenient it is to collect.** That is the honest framing, and it should inform what you
put in shared state.

::: danger Never put secrets in shared state
No tokens, no API keys, no PII you would not hand to every script on the page. The same applies to the
`meta` object on `<DualScreen>`, which is broadcast in every presence message.
:::

## Treat shared state as untrusted input

Anything arriving from another window is attacker-controllable in exactly the circumstances above.
Validate it the same way you would validate a query parameter.

This matters most for **routes**, because applications routinely feed them straight into a navigation
sink:

```tsx
const route = useSurfaceRoute()

// ❌ a hostile route becomes an open redirect, or script execution
location.href = route

// ✅ resolve against routes you control
const view = ROUTES[route] ?? ROUTES['/']
```

dualscreen drops routes carrying an executable scheme — `javascript:`, `data:`, `vbscript:`, `file:`,
including obfuscations like `java\tscript:` — but that is a backstop for one specific sink, **not**
validation of your route semantics. An open redirect to an attacker-controlled path on your own origin
sails straight through it.

## What the library defends against

These are enforced in code and covered by
[regression tests](https://github.com/phiceti/dualscreen/blob/main/packages/core/test/security.test.ts).

| Defence | Why |
| --- | --- |
| **`__proto__`, `constructor`, `prototype` rejected as state keys** | `obj['__proto__'] = value` invokes the prototype setter instead of creating a property. A peer writing that key could replace the prototype of the object `getAll()` returns — and because it is not an own property, `Object.keys()` shows nothing, so the injected value is invisible to you *and* to the devtools panel. |
| **Cross-origin surface windows refused** | An opened window receives a `window.opener` handle back to the opener. Cross-origin, that enables reverse tabnabbing. dualscreen has no legitimate cross-origin case — `BroadcastChannel` is origin-scoped, so such a window could not join the channel anyway. |
| **Surface names constrained** to `[A-Za-z0-9_-]{1,64}` | The name comes from a URL anyone can craft and then flows into Web Lock names, state keys, peer ids, and `localStorage` keys. An unrecognised name falls back to the primary window, so a hostile link degrades to your normal app. |
| **Every wire payload shape-checked** | Payloads cross the transport as `unknown`. An entry missing `version` would make comparisons `NaN` and silently corrupt convergence — much harder to notice than a dropped message. |
| **Message handling is exception-isolated** | A throw inside a handler would propagate into the transport dispatch loop and skip every handler after it. One malformed message must not take the link down. |
| **Snapshot peer lists capped** | A snapshot comes from whichever window holds leadership, and any script can be that window. |
| **Protocol version mismatches ignored** | A stale tab left open across a deploy must not break a fresh one. |
| **Executable route schemes filtered** | See above. |

## What it does not defend against

Be clear-eyed about the limits:

- **XSS on your origin.** If an attacker can run script on your page, they have your cookies, your
  session, and your DOM. Channel access is the least of it. dualscreen neither helps nor hinders here.
- **Malicious first-party code.** Anything in your bundle is inside the boundary by definition.
- **A hostile peer sending *valid* messages.** Shape validation is not semantic validation. A peer can
  legitimately set `selectedExperiment` to any id it likes; whether that id is one the user may see is
  your authorisation question, enforced where you fetch the data — not here.
- **Traffic analysis by a same-origin observer.** Any script can tap the channel and watch behaviour.

## Practical guidance

**Authorise on the server, always.** A window acting on a shared id must still be authorised to see
that data. Because the second window is same-origin it inherits the session, so its fetches are
authenticated — but "authenticated" is not "authorised". Never treat a value arriving over the channel
as proof that the user may see the thing it points at.

**Namespace your channel.** Use something specific and stable (`acme-lims-v1`, not `app`). This is
collision-avoidance between apps on one origin, not a secret — a channel name grants no protection.

**Keep surface URLs as trustworthy as any deep link.** `?ds=inspector` renders a chrome-less view of
your app. That is no more dangerous than any other deep link, but if your app has views that would be
misleading without surrounding chrome, be aware they can be linked to directly.

**Scope your CSP.** dualscreen needs no `unsafe-inline`, no `unsafe-eval`, and makes no network
requests of its own. It should not require any CSP relaxation.

**Gate the devtools overlay.** It renders shared state to the DOM. Strip it in production:

```tsx
{import.meta.env.DEV && <DualScreenDevtools />}
```

**If you add a relay transport,** you have taken on a genuinely different problem: authentication,
pairing, room authorisation, and transport encryption all become yours. See
[Custom transports](/guide/transports).

## Reporting a vulnerability

Please report privately via [GitHub security
advisories](https://github.com/phiceti/dualscreen/security/advisories/new) rather than a public
issue. See [SECURITY.md](https://github.com/phiceti/dualscreen/blob/main/SECURITY.md).
