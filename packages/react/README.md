# @dualscreen/react

React bindings for [dualscreen](https://phiceti.github.io/dualscreen) — hooks and components for driving a second monitor.

Most apps should install [`dualscreen`](https://www.npmjs.com/package/dualscreen) instead and import
from `dualscreen/react`.

[Documentation](https://phiceti.github.io/dualscreen/api/react) · [Live demos](https://phiceti.github.io/dualscreen/demo/) · [GitHub](https://github.com/phiceti/dualscreen)

```bash
npm install @dualscreen/react react
```

```tsx
import { DualScreen, useShared, useSurface } from '@dualscreen/react'

<DualScreen channel="my-app">
  <DualScreen.Main><Workspace /></DualScreen.Main>
  <DualScreen.Surface name="inspector"><Inspector /></DualScreen.Surface>
</DualScreen>
```

## Hooks

| | |
| --- | --- |
| `useShared(key, initial?)` | A value replicated to every window. |
| `useEphemeral(key, initial?)` | rAF-coalesced, excluded from late-join snapshots. |
| `useSurface(name)` | `open`, `close`, `navigate`, `isConnected`, `mode` |
| `useSurfaceRoute()` | The route this surface was told to show. |
| `usePeers()` | Every connected window. |
| `useCommand(name, fn)` / `useSend()` | One-off events. |
| `useScreens()` | Layout, permission, placement mode. |
| `useSharedState()` | Every shared value at once. |
| `useIsLeader()` / `useLinkReady()` | Coordination primitives. |
| `useDualScreen()` | Escape hatch to the underlying `Link`. |

On a single display, `<DualScreen.Surface>` renders **inline in a resizable split pane** from the same
JSX — not a second code path.

[API reference →](https://phiceti.github.io/dualscreen/api/react)

## License

MIT
