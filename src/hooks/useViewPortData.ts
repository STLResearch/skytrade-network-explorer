import { useState, useEffect, useCallback } from "react"
import { MapRef, ViewStateChangeEvent } from "react-map-gl"

/**
 * Type for viewport information
 */
type Viewport = {
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  zoom: number
  width: number
  height: number
}

/**
 * Custom hook to track and manage viewport-specific data
 */
export function useViewportData(mapRef: React.RefObject<MapRef>) {
  const [viewport, setViewport] = useState<Viewport | null>(null)

  // Update viewport data when map moves
  const updateViewport = useCallback(() => {
    if (!mapRef.current) return

    const map = mapRef.current.getMap()
    const bounds = map.getBounds()
    const zoom = map.getZoom()
    const { width, height } = map.getCanvas()

    setViewport({
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      zoom,
      width,
      height,
    })
  }, [mapRef])

  // Calculate if a point is in the current viewport
  const isPointInViewport = useCallback(
    (lat: number, lng: number): boolean => {
      if (!viewport) return false

      return (
        lat >= viewport.bounds.south &&
        lat <= viewport.bounds.north &&
        lng >= viewport.bounds.west &&
        lng <= viewport.bounds.east
      )
    },
    [viewport]
  )

  // Calculate if a point is visible on screen (not just in bounds)
  const isPointVisible = useCallback(
    (lat: number, lng: number): boolean => {
      if (!mapRef.current || !viewport) return false

      try {
        const map = mapRef.current.getMap()
        const point = map.project([lng, lat])

        return (
          point.x >= 0 &&
          point.y >= 0 &&
          point.x <= viewport.width &&
          point.y <= viewport.height
        )
      } catch (err) {
        console.error("Error checking point visibility:", err)
        return false
      }
    },
    [mapRef, viewport]
  )

  return {
    viewport,
    updateViewport,
    isPointInViewport,
    isPointVisible,
  }
}
