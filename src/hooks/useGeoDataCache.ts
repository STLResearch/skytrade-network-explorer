import { useState, useRef, useMemo, useCallback } from "react"

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
 * Interface for a cached area in our spatial cache
 */
type CachedArea = {
  bounds: GeoBounds
  zoomLevel: number
  timestamp: number
}

/**
 * Constants for cache management
 */
const CACHE_EXPIRY_TIME = 5 * 60 * 1000 // 5 minutes in milliseconds
const OVERLAP_THRESHOLD = 0.7 // 70% overlap required to consider an area cached

/**
 * Custom hook for caching geographic data by area
 * Helps prevent redundant API calls for areas we've already loaded
 */
export function useGeoDataCache<T extends { id: string }>(cacheType: string) {
  // Main data storage
  const [cachedData, setCachedData] = useState<T[]>([])

  // Keep track of which geographic areas we've already loaded
  const cachedAreas = useRef<CachedArea[]>([])

  /**
   * Calculate the area of a bounding box in square degrees
   */
  const calculateArea = useCallback((bounds: GeoBounds): number => {
    return (bounds.north - bounds.south) * (bounds.east - bounds.west)
  }, [])

  /**
   * Calculate the area of overlap between two bounding boxes
   */
  const calculateOverlap = useCallback(
    (bounds1: GeoBounds, bounds2: GeoBounds): number => {
      const xOverlap = Math.max(
        0,
        Math.min(bounds1.east, bounds2.east) -
          Math.max(bounds1.west, bounds2.west)
      )

      const yOverlap = Math.max(
        0,
        Math.min(bounds1.north, bounds2.north) -
          Math.max(bounds1.south, bounds2.south)
      )

      return xOverlap * yOverlap
    },
    []
  )

  /**
   * Check if we have sufficiently cached an area at a particular zoom level
   */
  const checkAreaCached = useCallback(
    (bounds: GeoBounds, currentZoom: number): boolean => {
      // Clean expired cache entries first
      const now = Date.now()
      cachedAreas.current = cachedAreas.current.filter(
        (area) => now - area.timestamp < CACHE_EXPIRY_TIME
      )

      // Calculate the area of the requested bounds
      const requestedArea = calculateArea(bounds)

      // Look for cached areas at the same zoom level
      const relevantCacheEntries = cachedAreas.current.filter((area) => {
        // Only consider entries at similar or more detailed zoom levels
        return Math.abs(area.zoomLevel - currentZoom) <= 1
      })

      // If there are no relevant cache entries, the area is not cached
      if (relevantCacheEntries.length === 0) {
        return false
      }

      // Check if the requested area is sufficiently covered by our cached areas
      let totalOverlap = 0

      for (const cachedArea of relevantCacheEntries) {
        const overlap = calculateOverlap(bounds, cachedArea.bounds)
        totalOverlap += overlap

        // If this single area provides sufficient coverage, we're done
        if (overlap / requestedArea >= OVERLAP_THRESHOLD) {
          return true
        }
      }

      // Check if the combined overlap is sufficient
      return totalOverlap / requestedArea >= OVERLAP_THRESHOLD
    },
    [calculateArea, calculateOverlap]
  )

  /**
   * Mark an area as cached at a specific zoom level
   */
  const markAreaCached = useCallback(
    (bounds: GeoBounds, zoomLevel: number): void => {
      cachedAreas.current.push({
        bounds,
        zoomLevel,
        timestamp: Date.now(),
      })

      // Limit the number of cached areas to prevent memory issues
      if (cachedAreas.current.length > 100) {
        // Sort by timestamp (oldest first) and remove oldest entries
        cachedAreas.current.sort((a, b) => a.timestamp - b.timestamp)
        cachedAreas.current = cachedAreas.current.slice(-100)
      }
    },
    []
  )

  /**
   * Get stats about the cache
   */
  const cacheStats = useMemo(
    () => ({
      dataCount: cachedData.length,
      areasCount: cachedAreas.current.length,
      cacheType,
    }),
    [cachedData.length, cacheType]
  )

  /**
   * Clear all cached data and areas
   */
  const clearCache = useCallback(() => {
    setCachedData([])
    cachedAreas.current = []
  }, [])

  /**
   * Prune data not in the current viewport to manage memory
   */
  const pruneDataOutsideViewport = useCallback(
    (
      currentBounds: GeoBounds,
      getLatLng: (item: T) => [number | undefined, number | undefined]
    ): void => {
      setCachedData((prev) =>
        prev.filter((item) => {
          const [lat, lng] = getLatLng(item)
          if (lat === undefined || lng === undefined) return false

          return (
            lat >= currentBounds.south &&
            lat <= currentBounds.north &&
            lng >= currentBounds.west &&
            lng <= currentBounds.east
          )
        })
      )
    },
    []
  )

  return {
    cachedData,
    setCachedData,
    checkAreaCached,
    markAreaCached,
    cacheStats,
    clearCache,
    pruneDataOutsideViewport,
  }
}
