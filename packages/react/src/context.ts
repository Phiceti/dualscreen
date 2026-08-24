import { createContext, useContext, type MutableRefObject } from 'react'
import type { Link } from '@dualscreen/core'
import type { PlacementMode, ScreenLayout } from '@dualscreen/screens'

/** Internal registry entry for a surface the main window has opened. */
export interface OpenSurfaceRecord {
  /** Rendered inline in a split pane rather than in its own window. */
  inline: boolean
  /** Handle to the real window, when there is one. */
  close: () => void
  focus: () => void
}

export interface DualScreenContextValue {
  link: Link
  /** The surface this window renders. `'main'` for the primary window. */
  role: string
  /** True in the primary window. */
  isMain: boolean
  /** Current display layout, refreshed as monitors change. */
  layout: ScreenLayout | null
  /** What placement this browser currently allows. */
  mode: PlacementMode
  /** Ask for the `window-management` permission and re-read the layout. */
  refreshLayout: () => Promise<ScreenLayout>
  /** Surfaces currently open, keyed by name. */
  openSurfaces: Record<string, OpenSurfaceRecord>
  /** Register a surface as open. Internal. */
  registerSurface: (name: string, record: OpenSurfaceRecord) => void
  /** Deregister a surface. Internal. */
  unregisterSurface: (name: string) => void
  /** How the split fallback lays out. */
  splitDirection: 'row' | 'column'
  /** Fraction of the split given to the main pane. */
  splitRatio: number
  /** Adjust the split. Driven by the divider. */
  setSplitRatio: (ratio: number) => void
  /** The provider's root element, used to measure divider drags. */
  rootRef: MutableRefObject<HTMLDivElement | null>
}

export const DualScreenContext = createContext<DualScreenContextValue | null>(null)

/**
 * Access the dualscreen context.
 *
 * @throws if called outside a `<DualScreen>` provider.
 */
export function useDualScreen(): DualScreenContextValue {
  const ctx = useContext(DualScreenContext)
  if (!ctx) {
    throw new Error(
      '[dualscreen] useDualScreen() was called outside a <DualScreen> provider. ' +
        'Wrap your app in <DualScreen channel="your-app"> first.',
    )
  }
  return ctx
}

/** The shared-state key that carries a surface's current route. */
export function routeKey(surface: string): string {
  return `ds:route:${surface}`
}
