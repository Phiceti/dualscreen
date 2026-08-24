import { useEffect, useRef, useState } from 'react'

/**
 * Measure an element, so charts are sized in real pixels rather than guessed.
 *
 * Falls back to a static measurement where `ResizeObserver` is unavailable
 * (older engines, some test environments) rather than throwing — a chart that
 * does not resize is far better than a page that does not render.
 */
export function useSize<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (typeof ResizeObserver === 'undefined') {
      setSize({ width: element.clientWidth, height: element.clientHeight })
      return
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
