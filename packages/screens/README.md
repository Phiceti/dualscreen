# @dualscreen/screens

Display detection and window placement for [dualscreen](https://phiceti.github.io/dualscreen).

Most apps should install [`dualscreen`](https://www.npmjs.com/package/dualscreen) instead.

[Documentation](https://phiceti.github.io/dualscreen/api/screens) · [GitHub](https://github.com/phiceti/dualscreen)

```bash
npm install @dualscreen/screens
```

```ts
import { getScreenLayout, openSurfaceWindow } from '@dualscreen/screens'

// Safe on page load — never prompts.
const layout = await getScreenLayout()
if (layout.isExtended) showSecondScreenButton()

// Must be called from a user gesture.
const handle = await openSurfaceWindow({ url: '?ds=inspector', screen: 'auto' })
```

## Notes

Placement is a **progressive enhancement**. The
[Window Management API](https://developer.mozilla.org/en-US/docs/Web/API/Window_Management_API) is
Chromium-only, so everywhere else a window opens as an ordinary popup the user positions once.

`openSurfaceWindow` calls `window.open()` **synchronously before any `await`** — awaiting first would
spend the user gesture and get the popup blocked — then resolves the display layout and moves the
window into place.

Cross-origin URLs are refused: an opened window receives a `window.opener` handle back, which
cross-origin enables reverse tabnabbing, and such a window could never join the channel anyway.

[API reference →](https://phiceti.github.io/dualscreen/api/screens)

## License

MIT
