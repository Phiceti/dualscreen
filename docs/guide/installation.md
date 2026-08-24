# Installation

## The meta package

```bash
npm install dualscreen
# pnpm add dualscreen · yarn add dualscreen · bun add dualscreen
```

`react` is an optional peer dependency — needed only if you use the React bindings.

Entry points:

| Import | Contents |
| --- | --- |
| `dualscreen` | Framework-agnostic core. No React dependency. |
| `dualscreen/react` | Hooks and components. |
| `dualscreen/screens` | Display detection and placement. |
| `dualscreen/devtools` | Debug overlay. Dev-only. |

## Individual packages

If you want a smaller dependency graph, install only what you use:

```bash
npm install @dualscreen/core          # 4.8 kB gzip, no framework
npm install @dualscreen/react         # + hooks and components
npm install @dualscreen/screens       # + display detection
npm install -D @dualscreen/devtools   # dev-only overlay
```

`@dualscreen/react` depends on `core` and `screens`, so installing it is enough.

## Requirements

| | |
| --- | --- |
| Browsers | Anything with `BroadcastChannel` — Chrome 54+, Firefox 38+, Safari 15.4+ |
| React | 18 or 19, only if using the React bindings |
| TypeScript | Types are bundled; no `@types` package needed |
| Secure context | HTTPS or `localhost`, required by Web Locks and Window Management |

Everything degrades if an API is missing — see [Browser support](/guide/browser-support).

## Bundle size

| Package | min+gzip |
| --- | ---: |
| `@dualscreen/core` | 4.8 kB |
| `@dualscreen/screens` | 2.3 kB |
| `@dualscreen/react` | 2.9 kB |
| `@dualscreen/devtools` | 1.9 kB |

Full React stack: **~10 kB gzipped, zero third-party runtime dependencies.** All packages are ESM and
CJS, side-effect free, and tree-shakeable.
