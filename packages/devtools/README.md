# @dualscreen/devtools

Debug overlay for [dualscreen](https://phiceti.github.io/dualscreen) — peers, shared state, and live protocol traffic.

[Documentation](https://phiceti.github.io/dualscreen/api/devtools) · [GitHub](https://github.com/phiceti/dualscreen)

```bash
npm install -D @dualscreen/devtools
```

```tsx
import { DualScreenDevtools } from '@dualscreen/devtools'

<DualScreen channel="my-app">
  {/* … */}
  {import.meta.env.DEV && <DualScreenDevtools />}
</DualScreen>
```

Render it in **both** windows. Debugging two windows is harder than debugging one — you cannot watch two
consoles at once, and the interesting failures are the ones where the windows disagree. Side by side,
the disagreement is usually obvious immediately.

The protocol tap is only attached while the traffic tab is visible, so the overlay costs nothing on the
hot path the rest of the time.

Gate it yourself so bundlers can drop it — there is no `NODE_ENV` guard built in.

[API reference →](https://phiceti.github.io/dualscreen/api/devtools)

## License

MIT
