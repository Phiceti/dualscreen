import { useEffect, useState } from 'react'

/**
 * A hash router in fifteen lines.
 *
 * Hash routing, not path routing, so the built demo works on any static host
 * with no rewrite rules — and so `surfaceUrl()` carries the current demo along
 * to the secondary window automatically, since it only touches the query
 * string and leaves the hash alone.
 */
export function useHashRoute(): string {
  const read = () => (typeof location === 'undefined' ? '/' : location.hash.replace(/^#/, '') || '/')
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
