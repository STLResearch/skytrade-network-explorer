// hooks/useHexPrefetch.ts
import { useState, useRef, useCallback, useEffect } from "react"
import * as h3 from "h3-js"

/**
 * Type definition for geographic bounds
 */
type GeoBounds = {
  north: number
  south: number
  east: number
  west: number
}

/**
 * Custom hook for prefetching hex data when the user hovers near a hex
 * This helps reduce the perceived latency when clicking on a hex
 */
export function useHexPrefetch<T>(
  fetchHexData: (hexId: string, type: "drone" | "air_space") => Promise<T[]>,
  mapRef: React.RefObject<any>,
  currentZoom: number
) {
  // Track which hexes we've already prefetched
  const prefetchedHexes = useRef<Set<string>>(new Set())

  // Track the currently active prefetch request
  const [currentPrefetch, setCurrentPrefetch] = useState<{
    hexId: string
    type: "drone" | "air_space"
    inProgress: boolean
  } | null>(null)

  // Track the mouse position for potential prefetching
  const lastMousePosition = useRef<{ x: number; y: number } | null>(null)

  // Determine if a hex should be prefetched
  const shouldPrefetch = useCallback(
    (hexId: string, type: "drone" | "air_space"): boolean => {
      // Skip if we've already prefetched this hex
      const cacheKey = `${hexId}-${type}`
      if (prefetchedHexes.current.has(cacheKey)) {
        return false
      }

      // Skip if we're already prefetching something else
      if (currentPrefetch && currentPrefetch.inProgress) {
        return false
      }

      // Skip prefetching for very low-resolution hexes (large areas)
      // as they're likely to contain too much data
      const resolution = h3.getResolution(hexId)
      if (resolution < 5) {
        return false
      }

      return true
    },
    [currentPrefetch]
  )

  // Prefetch data for a specific hex
  const prefetchHexData = useCallback(
    async (hexId: string, type: "drone" | "air_space") => {
      const cacheKey = `${hexId}-${type}`

      if (!shouldPrefetch(hexId, type)) {
        return
      }

      // Mark as in progress
      setCurrentPrefetch({
        hexId,
        type,
        inProgress: true,
      })

      try {
        console.log(`[Prefetch] Starting prefetch for ${type} hex ${hexId}`)
        await fetchHexData(hexId, type)

        // Mark as prefetched
        prefetchedHexes.current.add(cacheKey)

        console.log(`[Prefetch] Completed prefetch for ${type} hex ${hexId}`)
      } catch (err) {
        console.error(
          `[Prefetch] Failed to prefetch ${type} hex ${hexId}:`,
          err
        )
      } finally {
        setCurrentPrefetch((prev) =>
          prev && prev.hexId === hexId ? { ...prev, inProgress: false } : prev
        )
      }
    },
    [fetchHexData, shouldPrefetch]
  )

  // Detect hover on or near a hex cell
  const handleMapHover = useCallback(
    (e: MouseEvent) => {
      if (!mapRef.current) return

      // Store mouse position
      lastMousePosition.current = { x: e.clientX, y: e.clientY }

      // If we're actively prefetching, don't start another one
      if (currentPrefetch?.inProgress) return

      // Use the map's built-in picking to find features under the mouse
      const map = mapRef.current.getMap()
      const { lngLat } = e as any // Type assertion to access lngLat
      const point = map.project([lngLat.lng, lngLat.lat])

      // Query map features at this point
      const features = map.queryRenderedFeatures(point, {
        layers: ["hex-fill-drone", "hex-fill-air_space"],
      })

      // Check if we found a hex feature
      if (features && features.length > 0) {
        const feature = features[0]
        const hexId = feature.properties?.hexId
        const type = feature.properties?.type as "drone" | "air_space"

        if (hexId && type && shouldPrefetch(hexId, type)) {
          // Start prefetching with a small delay to avoid prefetching
          // as the user moves rapidly across the map
          setTimeout(() => {
            // Only prefetch if the mouse is still in the same position
            if (
              lastMousePosition.current &&
              Math.abs(lastMousePosition.current.x - e.clientX) < 10 &&
              Math.abs(lastMousePosition.current.y - e.clientY) < 10
            ) {
              prefetchHexData(hexId, type)
            }
          }, 200)
        }
      }
    },
    [mapRef, currentPrefetch, shouldPrefetch, prefetchHexData]
  )

  // Clear prefetch cache when zoom level changes significantly
  useEffect(() => {
    const resolution = Math.max(3, Math.min(6, Math.floor(currentZoom / 2)))

    // Clear cache on significant zoom changes
    // because the hexes will be at different resolutions
    prefetchedHexes.current.clear()
  }, [currentZoom])

  return {
    prefetchHexData,
    isPrefetching: currentPrefetch?.inProgress || false,
    currentPrefetch,
    handleMapHover,
  }
}
