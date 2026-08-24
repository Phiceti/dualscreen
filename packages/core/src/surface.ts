/**
 * Surface naming and URL conventions.
 *
 * A secondary window is not a separate app — it is the *same* app, booted at
 * the same URL, told to render a different surface. That is the whole trick,
 * and it is why integrating dualscreen does not mean restructuring your state:
 * a surface is a route, and the primary window drives it.
 *
 * The instruction rides in a query parameter so it survives a reload, a
 * bookmark, and a copy-pasted link.
 */

/** Query parameter carrying the surface name. */
export const SURFACE_PARAM = 'ds'

/** The surface name used by the primary window. */
export const MAIN_SURFACE = 'main'

/**
 * Accepted shape of a surface name.
 *
 * The name is read from a URL anyone can craft, and it then flows into Web
 * Lock names, shared-state keys (`ds:route:<name>`), peer ids, and
 * `localStorage` keys. Constraining it to a short identifier keeps a hostile
 * link from colliding with those key spaces or bloating them, and means a
 * surface name is always safe to interpolate.
 */
const SURFACE_NAME = /^[A-Za-z0-9_-]{1,64}$/

/** Whether `name` is usable as a surface name. */
export function isValidSurfaceName(name: unknown): name is string {
  return typeof name === 'string' && SURFACE_NAME.test(name)
}

/** Read the surface this window should render from a URL. */
export function readSurface(href?: string): string {
  const url = href ?? (typeof location !== 'undefined' ? location.href : '')
  if (!url) return MAIN_SURFACE
  try {
    const value = new URL(url, 'http://localhost').searchParams.get(SURFACE_PARAM)
    // An unrecognisable name falls back to the primary window rather than
    // rendering nothing, so a mangled or hostile link degrades to the normal app.
    return isValidSurfaceName(value) ? value : MAIN_SURFACE
  } catch {
    return MAIN_SURFACE
  }
}

/** True when this window is rendering a secondary surface. */
export function isSecondarySurface(href?: string): boolean {
  return readSurface(href) !== MAIN_SURFACE
}

/**
 * Build the URL a secondary window should open.
 *
 * Defaults to the current document so the child inherits the same origin,
 * cookies, session, and bundle — no separate entry point to build or deploy.
 */
export function surfaceUrl(surface: string, options: { base?: string; route?: string } = {}): string {
  if (!isValidSurfaceName(surface)) {
    throw new Error(
      `[dualscreen] invalid surface name ${JSON.stringify(surface)}. ` +
        'Use 1–64 characters from A–Z, a–z, 0–9, hyphen, or underscore.',
    )
  }
  const base = options.base ?? (typeof location !== 'undefined' ? location.href : 'http://localhost/')
  const url = new URL(base, 'http://localhost')
  url.searchParams.set(SURFACE_PARAM, surface)
  if (options.route !== undefined) url.hash = options.route.startsWith('#') ? options.route.slice(1) : options.route
  return url.toString()
}

/**
 * Schemes that execute rather than navigate.
 *
 * Matched after stripping leading control characters and whitespace, because
 * browsers tolerate `java\tscript:` and `  javascript:` in a URL and would
 * still run it.
 */
const DANGEROUS_SCHEME = /^(?:javascript|data|vbscript|file):/i

/**
 * Whether a route from shared state is safe to hand to a navigation sink.
 *
 * A route travels through shared state, and every script on the origin can
 * write shared state. If an application assigns a route to `location.href`, an
 * `<a href>`, or a router that accepts absolute URLs, a `javascript:` value
 * becomes script execution. Routes are opaque application strings so this
 * cannot validate their *shape* — but it can reject the handful of schemes
 * that are never a legitimate route.
 *
 * This is a backstop, not a substitute for validating routes against your own
 * route table.
 */
export function isSafeRoute(route: unknown): route is string {
  if (typeof route !== 'string') return false
  if (route.length > 2048) return false
  // eslint-disable-next-line no-control-regex
  const normalised = route.replace(/[\u0000-\u0020]/g, '')
  return !DANGEROUS_SCHEME.test(normalised)
}
