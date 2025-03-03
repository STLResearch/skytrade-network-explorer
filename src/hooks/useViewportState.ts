import { useState, useEffect, useCallback } from "react"
import { geoDataService } from "../services/storage/GeoDataService"
import { MapRef } from "react-map-gl"

type TabType = "drone" | "air_space" | "both"

/**
 * Hook to manage map viewport state persistence
 * Allows saving and restoring the map view position
 */
export function useViewportState(
  mapRef: React.RefObject<MapRef>,
  initialTab: TabType
) {
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)

  // Save current viewport state
  const saveViewport = useCallback(
    async (zoom: number): Promise<void> => {
      if (!mapRef.current) return

      try {
        const map = mapRef.current.getMap()
        const center = map.getCenter()

        await geoDataService.saveViewportState(
          [center.lng, center.lat],
          zoom,
          currentTab
        )
      } catch (error) {
        console.error("Error saving viewport state:", error)
      }
    },
    [mapRef, currentTab]
  )

  // Restore viewport state
  const restoreViewport = useCallback(async (): Promise<boolean> => {
    if (!mapRef.current) return false

    try {
      setIsRestoring(true)

      const savedState = await geoDataService.getViewportState()

      if (savedState) {
        mapRef.current.flyTo({
          center: {
            lng: savedState.center[0],
            lat: savedState.center[1],
          },
          zoom: savedState.zoom,
          duration: 0, // No animation for initial load
        })

        // Update tab if it's different
        if (savedState.tab !== currentTab) {
          setCurrentTab(savedState.tab)
        }

        setIsRestoring(false)
        return true
      }
    } catch (error) {
      console.error("Error restoring viewport state:", error)
    }

    setIsRestoring(false)
    return false
  }, [mapRef, currentTab])

  // Restore on initial mount
  useEffect(() => {
    restoreViewport()
  }, [restoreViewport])

  return {
    currentTab,
    setCurrentTab,
    saveViewport,
    restoreViewport,
    isRestoring,
  }
}
