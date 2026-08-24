# Security policy

## Reporting a vulnerability

Please report security issues **privately** using [GitHub security
advisories](https://github.com/phiceti/dualscreen/security/advisories/new), not a public issue.

Include what you can: affected package and version, a description, reproduction steps, and impact. You
will get an acknowledgement within a few days.

## Supported versions

Pre-1.0, only the latest published version is supported.

## Trust model

`dualscreen` coordinates browser windows over `BroadcastChannel`, which is **scoped to an origin, not
to an application**. Any script running on the page — including third-party analytics, embedded
widgets, and compromised dependencies — can join a channel and read or write shared state.

The practical consequence: **never put secrets, tokens, or sensitive PII in shared state or in the
`meta` object.** Treat every value arriving from another window as untrusted input, and authorise
data access on the server rather than trusting an id received over the channel.

The full model, including what the library does and does not defend against, is documented at
[/guide/security](https://github.com/phiceti/dualscreen/blob/main/docs/guide/security.md).

## What is in scope

- Bypassing the state-key restrictions (`__proto__`, `constructor`, `prototype`)
- Opening a cross-origin surface window, or otherwise escaping the same-origin check
- Crashing or wedging a link with a crafted message
- Injection through surface names, routes, or channel names
- Any way one origin reaches another's channel

## What is not in scope

- Consequences of XSS on the host application — an attacker running script on your origin already has
  your session
- A malicious first-party script reading shared state; that is the documented trust model
- Semantic abuse using well-formed messages (authorisation is the application's job)
- Missing features of the Window Management API in non-Chromium browsers
