import React, { useMemo, useEffect, useState, useCallback, useRef } from "react"
import { Source, Layer, MapRef } from "react-map-gl"
import * as h3 from "h3-js"
import { FeatureCollection, Feature, Polygon } from "geojson"
import { useMapPerformance } from "../hooks/useMapPerformance"

// Define types
type TabType = "drone" | "air_space"
type PointType = {
  id: string
  latitude?: number
  longitude?: number
  deviceLocationLat?: number
  deviceLocationLng?: number
  // Other properties
}

interface HexGridVisualizationProps {
  mapRef: React.RefObject<MapRef>
  points: PointType[]
  currentZoom: number
  tab: TabType
}

// Constants for performance optimization
const MAX_FEATURES_PER_LAYER = 2000
const MIN_ZOOM_FOR_COUNT_LABELS = 7
const DYNAMIC_RENDERING_THRESHOLD = 5000

// H3 resolution mapping based on zoom level with performance considerations
export function getResolutionForZoom(
  zoom: number,
  performanceMode = false
): number {
  //   In performance mode, we use lower resolutions (bigger hexagons, fewer to render)
  const performanceOffset = performanceMode ? -1 : 0

  if (zoom < 3) return Math.max(2, 2 + performanceOffset) // Very coarse
  if (zoom < 4) return Math.max(3, 3 + performanceOffset)
  if (zoom < 5.5) return Math.max(4, 4 + performanceOffset)
  if (zoom < 7) return Math.max(5, 5 + performanceOffset)
  if (zoom < 9) return Math.max(6, 6 + performanceOffset)
  if (zoom < 11) return Math.max(7, 7 + performanceOffset)
  if (zoom < 13) return Math.max(8, 8 + performanceOffset)
  if (zoom < 15) return Math.max(9, 9 + performanceOffset)
  return Math.max(10, 10 + performanceOffset) // Very fine
}

// Improved points to hex grid conversion with memory and performance optimizations
export function pointsToHexGrid(
  points: PointType[],
  resolution: number,
  tab: TabType,
  maxFeatures: number = MAX_FEATURES_PER_LAYER
): FeatureCollection {
  if (points.length === 0) {
    return { type: "FeatureCollection", features: [] }
  }

  // Use a Map for better performance when counting points per cell
  const hexBins = new Map<string, number>()

  // Track valid points for debugging
  let validPoints = 0

  // Process each point
  for (const point of points) {
    // Get coordinates based on point type
    const lat = point.latitude ?? point.deviceLocationLat
    const lng = point.longitude ?? point.deviceLocationLng

    if (lat !== undefined && lng !== undefined) {
      validPoints++
      try {
        // Get the H3 index for this location at the current resolution
        const hexId = h3.latLngToCell(lat, lng, resolution)

        // Increment the count for this hex cell
        const currentCount = hexBins.get(hexId) || 0
        hexBins.set(hexId, currentCount + 1)
      } catch (err) {
        // Skip this point if there's an error
      }
    }
  }

  // If we have too many hex cells, we need to prioritize which ones to display
  let hexEntries = Array.from(hexBins.entries())

  // If we have more entries than our max, sort by count and take the top ones
  if (hexEntries.length > maxFeatures) {
    hexEntries.sort((a, b) => b[1] - a[1]) // Sort by count descending
    hexEntries = hexEntries.slice(0, maxFeatures)
  }

  // Convert the hex bins to GeoJSON features
  const features: Feature<Polygon>[] = []

  for (const [hexId, count] of hexEntries) {
    try {
      // Get the boundary coordinates for this hex cell
      const boundary = h3.cellToBoundary(hexId, true)

      // Create a GeoJSON Polygon feature
      const feature: Feature<Polygon> = {
        type: "Feature",
        properties: {
          hexId,
          count,
          resolution,
          type: tab,
        },
        geometry: {
          type: "Polygon",
          coordinates: [boundary],
        },
      }

      features.push(feature)
    } catch (err) {
      // Skip this hex if there's an error
    }
  }

  return {
    type: "FeatureCollection",
    features,
  }
}

// Optimized component to render the hex grid
export function HexGridVisualization({
  mapRef,
  points,
  currentZoom,
  tab,
}: HexGridVisualizationProps) {
  // Use our performance monitoring hook
  const { isPerformanceMode, getPerformanceRecommendations } =
    useMapPerformance()

  // State to store the hex grid data
  const [hexGridData, setHexGridData] = useState<FeatureCollection>({
    type: "FeatureCollection",
    features: [],
  })

  // Stats for debugging and user feedback
  const [stats, setStats] = useState({
    hexCells: 0,
    pointsProcessed: 0,
    generationTime: 0,
  })

  // Get performance recommendations
  const perfRecs = getPerformanceRecommendations()

  // Determine the appropriate resolution based on zoom and performance mode
  const resolution = useMemo(
    () => getResolutionForZoom(currentZoom, isPerformanceMode),
    [currentZoom, isPerformanceMode]
  )

  // Determine how many features we should render based on performance
  const maxFeatures = useMemo(() => {
    return isPerformanceMode
      ? perfRecs.maxVisiblePoints / 2
      : MAX_FEATURES_PER_LAYER
  }, [isPerformanceMode, perfRecs])

  // Use a throttled version of points to avoid over-processing
  const throttledPoints = useMemo(() => {
    // If we have a large number of points, sample them for better performance
    if (points.length > DYNAMIC_RENDERING_THRESHOLD) {
      const samplingRate = Math.min(
        1,
        DYNAMIC_RENDERING_THRESHOLD / points.length
      )
      return points.filter(() => Math.random() < samplingRate)
    }
    return points
  }, [points])

  // Cached hex grid reference to avoid redundant calculations
  const hexGridCache = useRef(new Map<string, FeatureCollection>())

  // Generate hex grid data efficiently with caching by resolution
  const generateHexGrid = useCallback(() => {
    if (throttledPoints.length === 0) {
      setHexGridData({ type: "FeatureCollection", features: [] })
      setStats({ hexCells: 0, pointsProcessed: 0, generationTime: 0 })
      return
    }

    // Create a cache key based on resolution and points signature
    // We use point count to detect if the dataset changed substantially
    const cacheKey = `${tab}-${resolution}-${throttledPoints.length}`

    // Check if we have this grid already calculated
    if (hexGridCache.current.has(cacheKey)) {
      const cachedGrid = hexGridCache.current.get(cacheKey)
      if (cachedGrid) {
        setHexGridData(cachedGrid)
        setStats({
          hexCells: cachedGrid.features.length,
          pointsProcessed: throttledPoints.length,
          generationTime: 0, // Cached, so no generation time
        })
        return
      }
    }

    // Wasn't in cache, so calculate new grid
    const startTime = performance.now()

    try {
      const newHexGrid = pointsToHexGrid(
        throttledPoints,
        resolution,
        tab,
        maxFeatures
      )
      setHexGridData(newHexGrid)

      // Save to cache for future use
      hexGridCache.current.set(cacheKey, newHexGrid)

      // Keep cache size under control
      if (hexGridCache.current.size > 10) {
        // Remove oldest entries - convert to array, sort, and take newest entries
        const entries = Array.from(hexGridCache.current.entries())
        entries.sort((a, b) => {
          // Extract resolution numbers from keys for comparison
          const resA = parseInt(a[0].split("-")[1])
          const resB = parseInt(b[0].split("-")[1])
          // Sort by resolution (higher is more detailed/valuable)
          return resB - resA
        })

        // Create new map with just the most valuable entries
        hexGridCache.current = new Map(entries.slice(0, 10))
      }

      const endTime = performance.now()
      setStats({
        hexCells: newHexGrid.features.length,
        pointsProcessed: throttledPoints.length,
        generationTime: Math.round(endTime - startTime),
      })
    } catch (err) {
      console.error(`[${tab}] Error generating hex grid:`, err)
      setHexGridData({ type: "FeatureCollection", features: [] })
    }
  }, [throttledPoints, resolution, tab, maxFeatures])

  // Generate the hex grid when inputs change
  useEffect(() => {
    // Use requestAnimationFrame to avoid blocking the main thread
    const handle = requestAnimationFrame(generateHexGrid)
    return () => cancelAnimationFrame(handle)
  }, [generateHexGrid])

  // Calculate the max count for styling
  const maxCount = useMemo(() => {
    return Math.max(
      ...hexGridData.features.map((f) => f.properties?.count || 0),
      1 // Fallback in case no features exist
    )
  }, [hexGridData.features])

  // Don't render anything if we don't have features
  if (hexGridData.features.length === 0) {
    return null
  }

  // Source ID for this visualization
  const sourceId = `hex-source-${tab}`

  return (
    <>
      <Source id={sourceId} type="geojson" data={hexGridData}>
        {/* Fill Layer */}
        <Layer
          id={`hex-fill-${tab}`}
          type="fill"
          source={sourceId}
          paint={{
            "fill-color":
              tab === "drone"
                ? maxCount <= 2
                  ? "rgba(153, 216, 201, 0.8)"
                  : [
                      "interpolate",
                      ["linear"],
                      ["get", "count"],
                      0,
                      "rgba(229, 245, 249, 0)",
                      1,
                      "rgba(229, 245, 249, 0.7)",
                      maxCount / 2,
                      "rgba(153, 216, 201, 0.8)",
                      maxCount,
                      "rgba(44, 162, 95, 0.9)",
                    ]
                : maxCount <= 2
                ? "rgba(241, 238, 246, 0.7)"
                : [
                    "interpolate",
                    ["linear"],
                    ["get", "count"],
                    0,
                    "rgba(241, 238, 246, 0)",
                    1,
                    "rgba(241, 238, 246, 0.7)",
                    maxCount / 2,
                    "rgba(215, 181, 216, 0.8)",
                    maxCount,
                    "rgba(117, 107, 177, 0.9)",
                  ],
            "fill-opacity": 0.7,
          }}
        />

        {/* Line Layer - Only render at certain zoom levels for performance */}
        <Layer
          id={`hex-line-${tab}`}
          type="line"
          source={sourceId}
          minzoom={isPerformanceMode ? 6 : 5}
          paint={{
            "line-color": tab === "drone" ? "#11b4da" : "#da7111",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              0.3,
              12,
              0.8,
              16,
              1.2,
            ],
            "line-opacity": 0.6,
          }}
        />

        {/* Count Layer - Only show at higher zoom levels for better performance and readability */}
        <Layer
          id={`hex-count-${tab}`}
          type="symbol"
          source={sourceId}
          minzoom={
            isPerformanceMode
              ? MIN_ZOOM_FOR_COUNT_LABELS + 1
              : MIN_ZOOM_FOR_COUNT_LABELS
          }
          layout={{
            "text-field": String("{count}"),
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 12, 14],
            "text-allow-overlap": false,
            "symbol-sort-key": ["get", "count"], // Prioritize showing counts for cells with more points
            "text-ignore-placement": false,
          }}
          paint={{
            "text-color": tab === "drone" ? "#000000" : "#ffffff",
            "text-halo-color":
              tab === "drone" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)",
            "text-halo-width": 1.5,
          }}
        />
      </Source>

      {/* Optional performance stats overlay */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            position: "absolute",
            top: tab === "drone" ? "80px" : "110px",
            right: "10px",
            backgroundColor: "rgba(0,0,0,0.75)",
            color: "white",
            padding: "5px",
            borderRadius: "4px",
            fontSize: "12px",
            zIndex: 5,
            display: "none", // Hidden by default, enable for debugging
          }}
        >
          {tab}: {stats.hexCells} cells | {stats.pointsProcessed} points |{" "}
          {stats.generationTime}ms
          {isPerformanceMode && " (Performance Mode)"}
        </div>
      )}
    </>
  )
}
