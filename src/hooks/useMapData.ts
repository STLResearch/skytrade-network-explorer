import { useState, useEffect, useRef, useCallback } from "react"
import { Feature, FeatureCollection } from "geojson"
import { SpatialGridManager, GridBounds } from "../utils/SpatialGridManager"
import { mapCache } from "../utils/IndexedDbCache"

interface UseMapDataProps {
  dataType: "drone" | "air_space"
  initialBounds?: GridBounds
  apiBaseUrl: string
  convertToGeoJSON: (data: any[]) => Feature[]
  cacheTTL?: number // milliseconds
}

interface UseMapDataReturn {
  loading: boolean
  error: string | null
  data: FeatureCollection
  loadingCells: Set<string>
  failedCells: Set<string>
  loadBounds: (bounds: GridBounds) => void
  retryFailedCells: () => void
  clearCache: () => Promise<void>
}

export function useMapData({
  dataType,
  initialBounds,
  apiBaseUrl,
  convertToGeoJSON,
  cacheTTL = 15 * 60 * 1000, // Default: 15 minutes
}: UseMapDataProps): UseMapDataReturn {
  // State
  const [data, setData] = useState<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingCells, setLoadingCells] = useState<Set<string>>(new Set())
  const [failedCells, setFailedCells] = useState<Set<string>>(new Set())

  // Refs
  const gridManagerRef = useRef<SpatialGridManager>(new SpatialGridManager())

  // Initialize IndexedDB cache
  useEffect(() => {
    mapCache.init().catch((err) => {
      console.error("Failed to initialize IndexedDB cache:", err)
    })

    // Run cache cleanup periodically
    const cleanupInterval = setInterval(() => {
      mapCache.clearOldItems(cacheTTL).then((count) => {
        if (count > 0) {
          console.log(`Cleaned up ${count} expired items from cache`)
        }
      })
    }, 5 * 60 * 1000) // Run every 5 minutes

    return () => clearInterval(cleanupInterval)
  }, [cacheTTL])

  // Load data for a specific cell
  const loadCellData = useCallback(
    async (cellId: string, bounds: GridBounds) => {
      const gridManager = gridManagerRef.current

      // Mark cell as loading to prevent duplicate requests
      if (loadingCells.has(cellId)) return

      try {
        // Set loading state
        setLoadingCells((prev) => new Set([...prev, cellId]))
        gridManager.markCellLoading(cellId)

        // Try to get from cache first
        const cachedData = await mapCache.getItem(cellId, dataType)

        if (cachedData && Date.now() - cachedData.timestamp < cacheTTL) {
          // Use cached data
          gridManager.addDataToCell(cellId, cachedData.features)
          setData(gridManager.getFeatureCollection())

          // Update loading state
          setLoadingCells((prev) => {
            const newSet = new Set(prev)
            newSet.delete(cellId)
            return newSet
          })

          return
        }

        // Construct the API URL
        const endpoint = dataType === "drone" ? "droneRadar" : "properties"
        const url = `${apiBaseUrl}/${endpoint}/?maxLatitude=${bounds.north}&minLatitude=${bounds.south}&maxLongitude=${bounds.east}&minLongitude=${bounds.west}`

        // Fetch data from API
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        // Parse response
        const responseData = await response.json()

        // Convert to GeoJSON features
        const features = convertToGeoJSON(responseData)

        // Store in grid manager
        gridManager.addDataToCell(cellId, features)

        // Store in IndexedDB cache
        await mapCache.setItem(cellId, features, dataType)

        // Update state with full dataset
        setData(gridManager.getFeatureCollection())

        // Update loading state
        setLoadingCells((prev) => {
          const newSet = new Set(prev)
          newSet.delete(cellId)
          return newSet
        })

        // Remove from failed cells if it was there
        if (failedCells.has(cellId)) {
          setFailedCells((prev) => {
            const newSet = new Set(prev)
            newSet.delete(cellId)
            return newSet
          })
        }

        // Clear error if all cells are loaded
        if (loadingCells.size === 1) {
          setError(null)
        }
      } catch (error) {
        console.error(`Error loading data for cell ${cellId}:`, error)

        // Mark as failed
        gridManager.markCellLoadFailed(cellId)

        // Update state
        setFailedCells((prev) => new Set([...prev, cellId]))

        // Remove from loading cells
        setLoadingCells((prev) => {
          const newSet = new Set(prev)
          newSet.delete(cellId)
          return newSet
        })

        // Set error message if this was the last loading cell
        if (loadingCells.size === 1) {
          setError("Failed to load map data. Please try again.")
        }
      }
    },
    [
      dataType,
      apiBaseUrl,
      convertToGeoJSON,
      loadingCells,
      failedCells,
      cacheTTL,
    ]
  )

  // Load data for a geographic bounds
  const loadBounds = useCallback(
    (bounds: GridBounds) => {
      // Don't load for very large areas (world view)
      if (bounds.north - bounds.south > 50 || bounds.east - bounds.west > 100) {
        return
      }

      // Set master loading state if no cells are currently loading
      if (loadingCells.size === 0) {
        setLoading(true)
      }

      // Adjust grid resolution based on the size of the bounds
      const boundsSize =
        (bounds.north - bounds.south) * (bounds.east - bounds.west)
      if (boundsSize > 500) {
        gridManagerRef.current.setResolutionForZoom(4) // Country view
      } else if (boundsSize > 100) {
        gridManagerRef.current.setResolutionForZoom(6) // Region view
      } else if (boundsSize > 10) {
        gridManagerRef.current.setResolutionForZoom(10) // City view
      } else {
        gridManagerRef.current.setResolutionForZoom(14) // Neighborhood view
      }

      // Get cells that need loading
      const cellsToLoad = gridManagerRef.current.getCellsToLoad(bounds)

      // If no cells need loading, unset loading state
      if (cellsToLoad.length === 0) {
        setLoading(false)
        return
      }

      // Load each cell
      cellsToLoad.forEach((cell) => {
        loadCellData(cell.id, cell.bounds)
      })

      // Update loading state when all cells are loaded
      if (loadingCells.size === 0 && failedCells.size === 0) {
        setLoading(false)
      }
    },
    [loadCellData, loadingCells.size, failedCells.size]
  )

  // Retry loading failed cells
  const retryFailedCells = useCallback(() => {
    setError(null)

    // Get the list of failed cells
    const cellsToRetry = Array.from(failedCells)

    // Clear failed cells list
    setFailedCells(new Set())

    // Retry each cell
    cellsToRetry.forEach((cellId) => {
      const bounds = gridManagerRef.current.getBoundsFromCellId(cellId)
      loadCellData(cellId, bounds)
    })
  }, [failedCells, loadCellData])

  // Clear the cache
  const clearCache = useCallback(async () => {
    // Clear IndexedDB
    await mapCache.clearAll()

    // Reset grid manager
    gridManagerRef.current = new SpatialGridManager()

    // Reset state
    setData({ type: "FeatureCollection", features: [] })
    setLoadingCells(new Set())
    setFailedCells(new Set())
    setError(null)

    // If initialBounds was provided, load them
    if (initialBounds) {
      loadBounds(initialBounds)
    }
  }, [initialBounds, loadBounds])

  // Load initial data on mount
  useEffect(() => {
    if (initialBounds) {
      loadBounds(initialBounds)
    }
  }, [initialBounds, loadBounds])

  return {
    loading,
    error,
    data,
    loadingCells,
    failedCells,
    loadBounds,
    retryFailedCells,
    clearCache,
  }
}
