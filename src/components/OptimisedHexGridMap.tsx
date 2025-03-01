"use client"

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useTheme } from "next-themes"
import maplibregl from "maplibre-gl"
import { Protocol } from "pmtiles"
import ReactMap, {
  MapRef,
  NavigationControl,
  MapLayerMouseEvent,
  ViewStateChangeEvent,
} from "react-map-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import Sidebar from "./sidebar/index"
import { st } from "../styles/mapStyle"
import { HexGridVisualization } from "./OptimisedHexGridVisualisation"
import * as h3 from "h3-js"
import { useGeoDataCache } from "../hooks/useGeoDataCache"
import { useDebounce } from "../hooks/useDebounce"
import {
  DronePoint,
  PropertyPoint,
  PointType,
  GeoBounds,
  TabType,
} from "@/types"

// Constants
const INITIAL_MAP_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 4,
}
const MIN_MAP_ZOOM = 2
const MAX_MAP_ZOOM = 18
const MAP_CONTAINER_STYLE = { width: "100%", height: "100vh" }
const USA_BOUNDS = {
  north: 49.384358,
  south: 24.396308,
  east: -66.93457,
  west: -125.0,
}

// Define API batch size limits
const MAX_POINTS_PER_REQUEST = 500
const MIN_ZOOM_FOR_FULL_DETAIL = 10

// Helper function to get center coordinates from a hex
function getHexCenter(hexId: string): [number, number] {
  try {
    // Get the center coordinates of the hex cell
    const [lat, lng] = h3.cellToLatLng(hexId)
    return [lng, lat] // Return as [longitude, latitude] for mapbox
  } catch (err) {
    console.error(`Error getting hex center for ${hexId}`, err)
    return [0, 0] // Fallback
  }
}

// Helper function to convert API point to the expected DronePoint type
function convertToDronePoint(point: PointType): DronePoint {
  return {
    id: point.id,
    userId: point.userId || "unknown",
    deviceLocationLat: point.deviceLocationLat,
    deviceLocationLng: point.deviceLocationLng,
    ipAddress: point.ipAddress || "0.0.0.0",
    isTest: point.isTest || false,
    createdAt: point.createdAt || new Date().toISOString(),
    remoteData: point.remoteData || {},
  }
}

// Helper function to convert API point to the expected PropertyPoint type
function convertToPropertyPoint(point: PointType): PropertyPoint {
  return {
    id: point.id,
    title: point.title || "Untitled Property",
    address: point.address || "No address provided",
    hasLandingDeck: point.hasLandingDeck || false,
    hasChargingStation: point.hasChargingStation || false,
    hasStorageHub: point.hasStorageHub || false,
    isRentableAirspace: point.isRentableAirspace || false,
    latitude: point.latitude || 0,
    longitude: point.longitude || 0,
    noFlyZone: point.noFlyZone || false,
    isBoostedArea: point.isBoostedArea || false,
    transitFee: point.transitFee || "Unknown",
    ownerId: point.ownerId || "unknown",
  }
}

// Improved helper function to split large bounding boxes for more efficient data loading
function splitBoundsIfNeeded(bounds: GeoBounds, zoom: number): GeoBounds[] {
  // Only split bounds at lower zoom levels where the area is large
  if (zoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
    return [bounds] // Return original bounds if zoom is high enough
  }

  // Calculate area size to determine splitting strategy
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const areaSize = latSpan * lngSpan

  // At very low zoom levels (zoomed way out), we need more aggressive splitting
  // to avoid requesting data for huge areas
  if (zoom < 4 && areaSize > 400) {
    // Split into a 3x3 grid (9 smaller areas) for very large areas at low zoom
    const latStep = latSpan / 3
    const lngStep = lngSpan / 3

    const result: GeoBounds[] = []

    for (let latIdx = 0; latIdx < 3; latIdx++) {
      const south = bounds.south + latIdx * latStep
      const north = south + latStep

      for (let lngIdx = 0; lngIdx < 3; lngIdx++) {
        const west = bounds.west + lngIdx * lngStep
        const east = west + lngStep

        result.push({ north, south, east, west })
      }
    }

    return result
  } else if (zoom < 6 && areaSize > 100) {
    // Split into 4 quadrants for moderately large areas
    const midLat = (bounds.north + bounds.south) / 2
    const midLng = (bounds.east + bounds.west) / 2

    return [
      { north: bounds.north, south: midLat, east: midLng, west: bounds.west }, // Northwest
      { north: bounds.north, south: midLat, east: bounds.east, west: midLng }, // Northeast
      { north: midLat, south: bounds.south, east: midLng, west: bounds.west }, // Southwest
      { north: midLat, south: bounds.south, east: bounds.east, west: midLng }, // Southeast
    ]
  }

  // For smaller areas or higher zoom levels, don't split
  return [bounds]
}

// Helper function to estimate point density from the current visible data
function estimatePointDensity(points: PointType[], bounds: GeoBounds): number {
  if (points.length === 0) return 0

  // Count points in the given bounds
  const pointsInBounds = points.filter((point) => {
    const lat = point.latitude ?? point.deviceLocationLat
    const lng = point.longitude ?? point.deviceLocationLng

    if (lat === undefined || lng === undefined) return false

    return (
      lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east
    )
  })

  // Calculate area in square degrees
  const area = (bounds.north - bounds.south) * (bounds.east - bounds.west)

  // Points per square degree
  return pointsInBounds.length / Math.max(area, 0.001)
}

// Helper to check if two bounds overlap
function boundsOverlap(bounds1: GeoBounds, bounds2: GeoBounds): boolean {
  return !(
    bounds1.east < bounds2.west ||
    bounds1.west > bounds2.east ||
    bounds1.north < bounds2.south ||
    bounds1.south > bounds2.north
  )
}

export function HexGridMap({ tab = "both" }: { tab?: TabType }) {
  // Theme
  const { resolvedTheme } = useTheme()

  // Refs
  const mapRef = useRef<MapRef>(null)

  // State
  const [cursor, setCursor] = useState<string>("")
  const [currentZoom, setCurrentZoom] = useState<number>(
    INITIAL_MAP_VIEW_STATE.zoom
  )
  const [currentBounds, setCurrentBounds] = useState<GeoBounds>(USA_BOUNDS)
  const [isMapIdle, setIsMapIdle] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // State for hex cell points to display in sidebar
  const [selectedHexPoints, setSelectedHexPoints] = useState<PointType[]>([])
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null)
  const [selectedHexType, setSelectedHexType] = useState<"drone" | "air_space">(
    "drone"
  )
  const [showSidebar, setShowSidebar] = useState<boolean>(false)

  // Use our custom hooks for data caching and request debouncing
  const {
    cachedData: dronePoints,
    setCachedData: setDronePoints,
    checkAreaCached: isDroneAreaCached,
    markAreaCached: markDroneAreaCached,
  } = useGeoDataCache<PointType>("drone")

  const {
    cachedData: airSpacePoints,
    setCachedData: setAirSpacePoints,
    checkAreaCached: isAirSpaceAreaCached,
    markAreaCached: markAirSpaceAreaCached,
  } = useGeoDataCache<PointType>("air_space")

  // Debounce map move events to prevent too many API calls
  const debouncedBounds = useDebounce(currentBounds, 300)

  // Initialize maplibre protocol
  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol("basemaps", protocol.tile)
    return () => {
      maplibregl.removeProtocol("basemaps")
    }
  }, [])

  // Parse map style
  const mapStyle = React.useMemo(() => {
    const mapStyleString = JSON.stringify(st)
    return JSON.parse(mapStyleString)
  }, [])

  // Track previous zoom level to optimize zoom-based loading
  const prevZoomRef = useRef<number>(currentZoom)

  // Optimize which areas need data fetching with zoom-level intelligence
  const fetchAreasNeeded = useCallback(
    (
      bounds: GeoBounds,
      zoom: number,
      dataType: "drone" | "air_space",
      prevZoom: number
    ): GeoBounds[] => {
      // Calculate zoom level difference to determine if we need new data
      const zoomDiff = Math.abs(zoom - prevZoom)

      // Skip fetching if zoom change is minor (less than 1.5 levels) and we have some data
      // This prevents excessive fetching when making small zoom adjustments
      const dataPoints =
        dataType === "drone" ? dronePoints.length : airSpacePoints.length
      if (zoomDiff < 1.5 && dataPoints > 0 && zoom > prevZoom) {
        // On minor zoom in, we can use existing data
        return []
      }

      // Split bounds based on zoom level
      const splitBounds = splitBoundsIfNeeded(bounds, zoom)

      // Filter to only include areas that aren't already cached
      const checkCached =
        dataType === "drone" ? isDroneAreaCached : isAirSpaceAreaCached
      const areasNeeded = splitBounds.filter((area) => !checkCached(area, zoom))

      return areasNeeded
    },
    [
      isDroneAreaCached,
      isAirSpaceAreaCached,
      dronePoints.length,
      airSpacePoints.length,
    ]
  )

  // Optimized data fetching function
  const fetchData = useCallback(
    async (bounds: GeoBounds) => {
      if (!process.env.NEXT_PUBLIC_SKY_TRADE_API_URL) {
        console.error("API URL not set")
        setError("API URL not configured")
        return
      }

      // Skip fetching if map is still moving (will fetch when it stops)
      if (!isMapIdle) {
        return
      }

      const shouldFetchDrone = tab === "drone" || tab === "both"
      const shouldFetchAirSpace = tab === "air_space" || tab === "both"

      // Get the previous zoom level
      const prevZoom = prevZoomRef.current

      // Check if we have any areas that need data
      const droneAreasToFetch = shouldFetchDrone
        ? fetchAreasNeeded(bounds, currentZoom, "drone", prevZoom)
        : []

      const airSpaceAreasToFetch = shouldFetchAirSpace
        ? fetchAreasNeeded(bounds, currentZoom, "air_space", prevZoom)
        : []

      // Skip fetching if no new areas to fetch
      if (droneAreasToFetch.length === 0 && airSpaceAreasToFetch.length === 0) {
        return
      }

      setLoading(true)
      setError(null)

      // Fetch data for each area in parallel
      const fetchPromises: Promise<void>[] = []

      // Fetch drone data if needed
      if (droneAreasToFetch.length > 0) {
        for (const area of droneAreasToFetch) {
          const fetchDronePromise = async () => {
            try {
              const droneEndpoint = `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/?maxLatitude=${area.north}&minLatitude=${area.south}&maxLongitude=${area.east}&minLongitude=${area.west}&limit=${MAX_POINTS_PER_REQUEST}`

              // Add detail level parameter if at a high zoom level
              if (currentZoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
                droneEndpoint.concat("&detailLevel=high")
              }

              const droneResponse = await fetch(droneEndpoint)

              if (!droneResponse.ok) {
                throw new Error(`HTTP error! status: ${droneResponse.status}`)
              }

              const droneData: PointType[] = await droneResponse.json()

              // Add to cache, avoiding duplicates
              setDronePoints((prev) => {
                const existingIds = new Set(prev.map((p) => p.id))
                const newPoints = droneData.filter(
                  (p) => !existingIds.has(p.id)
                )
                return [...prev, ...newPoints]
              })

              // Mark this area as cached
              markDroneAreaCached(area, currentZoom)
            } catch (error) {
              console.error("Error fetching drone data:", error)
              throw error
            }
          }

          fetchPromises.push(fetchDronePromise())
        }
      }

      // Fetch airspace data if needed
      if (airSpaceAreasToFetch.length > 0) {
        for (const area of airSpaceAreasToFetch) {
          const fetchAirSpacePromise = async () => {
            try {
              const airSpaceEndpoint = `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/?maxLatitude=${area.north}&minLatitude=${area.south}&maxLongitude=${area.east}&minLongitude=${area.west}&limit=${MAX_POINTS_PER_REQUEST}`

              // Add detail level parameter if at a high zoom level
              if (currentZoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
                airSpaceEndpoint.concat("&detailLevel=high")
              }

              const airSpaceResponse = await fetch(airSpaceEndpoint)

              if (!airSpaceResponse.ok) {
                throw new Error(
                  `HTTP error! status: ${airSpaceResponse.status}`
                )
              }

              const airSpaceData: PointType[] = await airSpaceResponse.json()

              // Add to cache, avoiding duplicates
              setAirSpacePoints((prev) => {
                const existingIds = new Set(prev.map((p) => p.id))
                const newPoints = airSpaceData.filter(
                  (p) => !existingIds.has(p.id)
                )
                return [...prev, ...newPoints]
              })

              // Mark this area as cached
              markAirSpaceAreaCached(area, currentZoom)
            } catch (error) {
              console.error("Error fetching airspace data:", error)
              throw error
            }
          }

          fetchPromises.push(fetchAirSpacePromise())
        }
      }

      // Wait for all fetches to complete
      try {
        await Promise.all(fetchPromises)
      } catch (error) {
        console.error("Error in data fetching:", error)
        setError("Failed to load map data. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [
      tab,
      currentZoom,
      isMapIdle,
      fetchAreasNeeded,
      isDroneAreaCached,
      isAirSpaceAreaCached,
      markDroneAreaCached,
      markAirSpaceAreaCached,
      setDronePoints,
      setAirSpacePoints,
    ]
  )

  // Load initial data
  useEffect(() => {
    fetchData(USA_BOUNDS)
  }, [fetchData])

  // Cache previous requested bounds to avoid duplicate requests
  const previousBoundsRef = useRef<GeoBounds[]>([])

  // Helper function to determine if new bounds request is necessary
  const shouldFetchForBounds = useCallback((newBounds: GeoBounds): boolean => {
    // If we have no previous bounds, definitely fetch
    if (previousBoundsRef.current.length === 0) return true

    // Check if new bounds are substantially contained within previous requests
    for (const prevBounds of previousBoundsRef.current) {
      // Calculate overlap percentage
      const latOverlap = Math.max(
        0,
        Math.min(prevBounds.north, newBounds.north) -
          Math.max(prevBounds.south, newBounds.south)
      )

      const lngOverlap = Math.max(
        0,
        Math.min(prevBounds.east, newBounds.east) -
          Math.max(prevBounds.west, newBounds.west)
      )

      const newArea =
        (newBounds.north - newBounds.south) * (newBounds.east - newBounds.west)
      const overlapArea = latOverlap * lngOverlap

      // If the new bounds are over 85% contained in a previous request, skip
      if (overlapArea / newArea > 0.85) {
        return false
      }
    }

    return true
  }, [])

  // React to changes in debounced bounds
  useEffect(() => {
    if (isMapIdle && debouncedBounds) {
      // Only fetch if these bounds aren't redundant
      if (shouldFetchForBounds(debouncedBounds)) {
        fetchData(debouncedBounds)

        // Store these bounds for future reference
        previousBoundsRef.current.push(debouncedBounds)

        // Keep bounds history manageable
        if (previousBoundsRef.current.length > 10) {
          previousBoundsRef.current = previousBoundsRef.current.slice(-10)
        }
      }
    }
  }, [debouncedBounds, isMapIdle, fetchData, shouldFetchForBounds])

  // More efficient point filtering with spatial binning for large datasets
  const visibleDronePoints = useMemo(() => {
    if (!currentBounds) return dronePoints

    // For very large datasets, use spatial indexing
    if (dronePoints.length > 10000) {
      // Expanded bounds with buffer for smoother edge behavior
      const bufferedBounds = {
        north:
          currentBounds.north +
          (currentBounds.north - currentBounds.south) * 0.1,
        south:
          currentBounds.south -
          (currentBounds.north - currentBounds.south) * 0.1,
        east:
          currentBounds.east + (currentBounds.east - currentBounds.west) * 0.1,
        west:
          currentBounds.west - (currentBounds.east - currentBounds.west) * 0.1,
      }

      // Use H3 hex grid for efficient spatial indexing
      const resolution = Math.max(3, Math.min(6, Math.floor(currentZoom / 2)))

      // Create hexes for the visible area
      const visibleHexes = new Set<string>()

      // Calculate step size to avoid generating too many points
      const latStep = (bufferedBounds.north - bufferedBounds.south) / 10
      const lngStep = (bufferedBounds.east - bufferedBounds.west) / 10

      // Generate hexes for a grid of points in the visible area
      for (
        let lat = bufferedBounds.south;
        lat <= bufferedBounds.north;
        lat += latStep
      ) {
        for (
          let lng = bufferedBounds.west;
          lng <= bufferedBounds.east;
          lng += lngStep
        ) {
          try {
            const hexId = h3.latLngToCell(lat, lng, resolution)
            visibleHexes.add(hexId)
          } catch (err) {
            // Skip invalid points
          }
        }
      }

      // Add hexes for the bounding box edges to ensure complete coverage
      for (
        let lat = bufferedBounds.south;
        lat <= bufferedBounds.north;
        lat += latStep
      ) {
        try {
          visibleHexes.add(
            h3.latLngToCell(lat, bufferedBounds.west, resolution)
          )
          visibleHexes.add(
            h3.latLngToCell(lat, bufferedBounds.east, resolution)
          )
        } catch (err) {}
      }

      for (
        let lng = bufferedBounds.west;
        lng <= bufferedBounds.east;
        lng += lngStep
      ) {
        try {
          visibleHexes.add(
            h3.latLngToCell(bufferedBounds.south, lng, resolution)
          )
          visibleHexes.add(
            h3.latLngToCell(bufferedBounds.north, lng, resolution)
          )
        } catch (err) {}
      }

      // Now filter points using the hex index for efficient lookup
      return dronePoints.filter((point) => {
        const lat = point.deviceLocationLat
        const lng = point.deviceLocationLng

        if (lat === undefined || lng === undefined) return false

        try {
          const hexId = h3.latLngToCell(lat, lng, resolution)
          return visibleHexes.has(hexId)
        } catch (err) {
          return false
        }
      })
    }

    // For smaller datasets, direct filtering is more efficient
    return dronePoints.filter((point) => {
      const lat = point.deviceLocationLat ?? 0
      const lng = point.deviceLocationLng ?? 0
      return (
        lat >= currentBounds.south &&
        lat <= currentBounds.north &&
        lng >= currentBounds.west &&
        lng <= currentBounds.east
      )
    })
  }, [dronePoints, currentBounds, currentZoom])

  const visibleAirSpacePoints = useMemo(() => {
    if (!currentBounds) return airSpacePoints

    // For very large datasets, use spatial indexing
    if (airSpacePoints.length > 10000) {
      // Expanded bounds with buffer for smoother edge behavior
      const bufferedBounds = {
        north:
          currentBounds.north +
          (currentBounds.north - currentBounds.south) * 0.1,
        south:
          currentBounds.south -
          (currentBounds.north - currentBounds.south) * 0.1,
        east:
          currentBounds.east + (currentBounds.east - currentBounds.west) * 0.1,
        west:
          currentBounds.west - (currentBounds.east - currentBounds.west) * 0.1,
      }

      // Use H3 hex grid for efficient spatial indexing
      const resolution = Math.max(3, Math.min(6, Math.floor(currentZoom / 2)))

      // Create hexes for the visible area
      const visibleHexes = new Set<string>()

      // Calculate step size to avoid generating too many points
      const latStep = (bufferedBounds.north - bufferedBounds.south) / 10
      const lngStep = (bufferedBounds.east - bufferedBounds.west) / 10

      // Generate hexes for a grid of points in the visible area
      for (
        let lat = bufferedBounds.south;
        lat <= bufferedBounds.north;
        lat += latStep
      ) {
        for (
          let lng = bufferedBounds.west;
          lng <= bufferedBounds.east;
          lng += lngStep
        ) {
          try {
            const hexId = h3.latLngToCell(lat, lng, resolution)
            visibleHexes.add(hexId)
          } catch (err) {
            // Skip invalid points
          }
        }
      }

      // Add hexes for the bounding box edges to ensure complete coverage
      for (
        let lat = bufferedBounds.south;
        lat <= bufferedBounds.north;
        lat += latStep
      ) {
        try {
          visibleHexes.add(
            h3.latLngToCell(lat, bufferedBounds.west, resolution)
          )
          visibleHexes.add(
            h3.latLngToCell(lat, bufferedBounds.east, resolution)
          )
        } catch (err) {}
      }

      for (
        let lng = bufferedBounds.west;
        lng <= bufferedBounds.east;
        lng += lngStep
      ) {
        try {
          visibleHexes.add(
            h3.latLngToCell(bufferedBounds.south, lng, resolution)
          )
          visibleHexes.add(
            h3.latLngToCell(bufferedBounds.north, lng, resolution)
          )
        } catch (err) {}
      }

      // Now filter points using the hex index for efficient lookup
      return airSpacePoints.filter((point) => {
        const lat = point.latitude
        const lng = point.longitude

        if (lat === undefined || lng === undefined) return false

        try {
          const hexId = h3.latLngToCell(lat, lng, resolution)
          return visibleHexes.has(hexId)
        } catch (err) {
          return false
        }
      })
    }

    // For smaller datasets, direct filtering is more efficient
    return airSpacePoints.filter((point) => {
      const lat = point.latitude ?? 0
      const lng = point.longitude ?? 0
      return (
        lat >= currentBounds.south &&
        lat <= currentBounds.north &&
        lng >= currentBounds.west &&
        lng <= currentBounds.east
      )
    })
  }, [airSpacePoints, currentBounds, currentZoom])

  // Helper function to find points in a hex cell
  const findPointsInHex = useCallback(
    (hexId: string, pointType: "drone" | "air_space"): PointType[] => {
      const points =
        pointType === "drone" ? visibleDronePoints : visibleAirSpacePoints

      return points.filter((point) => {
        // Get coordinates based on point type
        const lat = point.latitude ?? point.deviceLocationLat
        const lng = point.longitude ?? point.deviceLocationLng

        if (lat === undefined || lng === undefined) return false

        // Get the H3 index for this location at the current resolution
        try {
          const resolution = h3.getResolution(hexId)
          const pointHexId = h3.latLngToCell(lat, lng, resolution)
          return pointHexId === hexId
        } catch (err) {
          console.error("Error checking if point is in hex:", err)
          return false
        }
      })
    },
    [visibleDronePoints, visibleAirSpacePoints]
  )

  // Map event handlers
  const handleMapMoveStart = useCallback(() => {
    setIsMapIdle(false)
  }, [])

  const handleMapMoveEnd = useCallback(() => {
    if (!mapRef.current) return

    const map = mapRef.current.getMap()
    const bounds = map.getBounds()

    const newBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    }

    setCurrentBounds(newBounds)
    setIsMapIdle(true)
  }, [])

  const handleZoomChange = useCallback((e: ViewStateChangeEvent) => {
    setCurrentZoom(e.viewState.zoom)
  }, [])

  // State to manage loading state and statistics for hex selection
  const [hexSelectionState, setHexSelectionState] = useState({
    isLoading: false,
    totalPoints: 0,
    loadedPoints: 0,
    hexId: null as string | null,
  })

  // Ref to track hex data that was looked up but empty
  const emptyHexesRef = useRef<Set<string>>(new Set())

  // Progressive hex data loading with pagination
  const loadHexData = useCallback(
    async (hexId: string, type: "drone" | "air_space") => {
      if (!process.env.NEXT_PUBLIC_SKY_TRADE_API_URL) {
        console.error("API URL not set")
        return []
      }

      // If we've already checked this hex and found no data, don't query again
      const hexCacheKey = `${hexId}-${type}`
      if (emptyHexesRef.current.has(hexCacheKey)) {
        return []
      }

      // Try to use locally cached data first
      const pointsInHex = findPointsInHex(hexId, type)

      // If we have a reasonable number of points already, use them without API call
      if (pointsInHex.length > 0) {
        // If we have enough points, consider this a complete dataset
        if (pointsInHex.length >= 5) {
          return pointsInHex
        }
      }

      // For small result sets, directly query the full dataset
      try {
        // Determine which endpoint to query
        const endpoint =
          type === "drone"
            ? `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/byHex/${hexId}`
            : `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/byHex/${hexId}`

        setHexSelectionState((prev) => ({ ...prev, isLoading: true, hexId }))

        // Get the h3 resolution for this hexId
        const resolution = h3.getResolution(hexId)

        // Use existing API with a workaround to limit to the hex boundary
        // This approach works with existing backend by using the hex's bounding area
        const hexBoundary = h3.cellToBoundary(hexId)

        // Find the north/south/east/west bounds
        const latitudes = hexBoundary.map(([lat]) => lat)
        const longitudes = hexBoundary.map(([_, lng]) => lng)

        const north = Math.max(...latitudes)
        const south = Math.min(...latitudes)
        const east = Math.max(...longitudes)
        const west = Math.min(...longitudes)

        // Call the existing API with the hex bounds
        const apiUrl =
          type === "drone"
            ? `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/?maxLatitude=${north}&minLatitude=${south}&maxLongitude=${east}&minLongitude=${west}&limit=500`
            : `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/?maxLatitude=${north}&minLatitude=${south}&maxLongitude=${east}&minLongitude=${west}&limit=500`

        const response = await fetch(apiUrl)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const responseData: PointType[] = await response.json()

        // Post-filter on the client side to exactly match the hex
        const filteredPoints = responseData.filter((point) => {
          // Get coordinates based on point type
          const lat = point.latitude ?? point.deviceLocationLat
          const lng = point.longitude ?? point.deviceLocationLng

          if (lat === undefined || lng === undefined) return false

          // Check if this point is actually in the requested hex
          try {
            const pointHexId = h3.latLngToCell(lat, lng, resolution)
            return pointHexId === hexId
          } catch (err) {
            return false
          }
        })

        // If we didn't find any data, add to our empty hexes set to avoid future calls
        if (filteredPoints.length === 0) {
          emptyHexesRef.current.add(hexCacheKey)
        }

        // Combine with any points we already had cached
        const allPoints = [...pointsInHex]

        // Add only new points that aren't already in our cache
        const existingIds = new Set(allPoints.map((p) => p.id))
        for (const point of filteredPoints) {
          if (!existingIds.has(point.id)) {
            allPoints.push(point)
            existingIds.add(point.id)
          }
        }

        // Cache these points for future use
        if (type === "drone") {
          setDronePoints((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const newPoints = filteredPoints.filter(
              (p) => !existingIds.has(p.id)
            )
            return [...prev, ...newPoints]
          })
        } else {
          setAirSpacePoints((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const newPoints = filteredPoints.filter(
              (p) => !existingIds.has(p.id)
            )
            return [...prev, ...newPoints]
          })
        }

        setHexSelectionState((prev) => ({
          ...prev,
          isLoading: false,
          totalPoints: allPoints.length,
          loadedPoints: allPoints.length,
        }))

        return allPoints
      } catch (error) {
        console.error(`Error fetching hex data for ${hexId}:`, error)
        setHexSelectionState((prev) => ({ ...prev, isLoading: false }))
        return pointsInHex // Fall back to whatever we had cached
      }
    },
    [findPointsInHex, setDronePoints, setAirSpacePoints]
  )

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      // Check if we clicked on a hex cell
      const hexFeatures = event.features?.filter(
        (f) => f.source?.startsWith("hex-source-") && f.properties?.hexId
      )

      if (hexFeatures && hexFeatures.length > 0) {
        const feature = hexFeatures[0]
        const hexId = feature.properties?.hexId
        const type = feature.properties?.type as "drone" | "air_space"
        const pointCount = feature.properties?.count || 0

        if (hexId) {
          // Show immediate feedback with what we have
          const initialPoints = findPointsInHex(hexId, type)

          // Use immediate feedback with cached data
          setSelectedHexPoints(initialPoints)
          setSelectedHexId(hexId)
          setSelectedHexType(type)
          setShowSidebar(true)

          // If this hex has a large count but we have few cached points,
          // or it's a higher zoom level hex (which is smaller and more specific),
          // then we should fetch the detailed data
          const resolution = h3.getResolution(hexId)
          const shouldFetchDetails =
            (pointCount > 5 && initialPoints.length < pointCount / 2) ||
            resolution >= 7

          if (shouldFetchDetails) {
            loadHexData(hexId, type).then((fullPoints) => {
              // Update the sidebar with the full dataset
              setSelectedHexPoints(fullPoints)
            })
          }

          // If there are multiple points and we're at a lower zoom level, zoom in
          if (pointCount > 1 && currentZoom < 14) {
            const center = getHexCenter(hexId)
            mapRef.current?.flyTo({
              center: {
                lng: center[0],
                lat: center[1],
              },
              zoom: Math.min(currentZoom + 2, 14),
              duration: 1000,
            })
          }
        }
      } else {
        // Clicked outside a hex - close sidebar
        setShowSidebar(false)
      }
    },
    [findPointsInHex, currentZoom, loadHexData]
  )

  const handleMouseEnter = useCallback(() => setCursor("pointer"), [])
  const handleMouseLeave = useCallback(() => setCursor(""), [])
  const handleClose = useCallback(() => setShowSidebar(false), [])

  // Determine which layers are interactive
  const interactiveLayerIds = useMemo(() => {
    const ids: string[] = []

    if (tab === "drone" || tab === "both") {
      ids.push("hex-fill-drone")
    }

    if (tab === "air_space" || tab === "both") {
      ids.push("hex-fill-air_space")
    }

    return ids
  }, [tab])

  // Convert generic PointType[] to the specific types expected by Sidebar
  const typedSidebarData = useMemo(() => {
    if (selectedHexType === "drone") {
      return selectedHexPoints.map(convertToDronePoint)
    } else {
      return selectedHexPoints.map(convertToPropertyPoint)
    }
  }, [selectedHexPoints, selectedHexType])

  // Stats for the UI
  const visibleStats = useMemo(
    () => ({
      droneCount: visibleDronePoints.length,
      airSpaceCount: visibleAirSpacePoints.length,
      totalDroneCount: dronePoints.length,
      totalAirSpaceCount: airSpacePoints.length,
    }),
    [
      visibleDronePoints.length,
      visibleAirSpacePoints.length,
      dronePoints.length,
      airSpacePoints.length,
    ]
  )

  return (
    <div className="relative h-full w-full">
      <ReactMap
        initialViewState={INITIAL_MAP_VIEW_STATE}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        style={MAP_CONTAINER_STYLE}
        mapStyle={mapStyle}
        localFontFamily="NotoSans-Regular"
        // @ts-ignore
        mapLib={maplibregl}
        onLoad={handleMapMoveEnd}
        interactiveLayerIds={interactiveLayerIds}
        onMoveStart={handleMapMoveStart}
        onMoveEnd={handleMapMoveEnd}
        onZoom={handleZoomChange}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor={cursor}
        ref={mapRef}
        attributionControl={false}
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-md bg-white bg-opacity-80 px-3 py-2 shadow-md dark:bg-zinc-800 dark:bg-opacity-80 dark:text-zinc-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Loading data...
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 transform items-center space-x-2 rounded-md border border-red-400 bg-red-100 px-4 py-2 text-red-700 shadow-md dark:border-red-700 dark:bg-red-900/50 dark:text-red-300">
            <svg
              className="h-5 w-5 text-red-500 dark:text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
            <button
              className="ml-2 rounded-md bg-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-300 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700"
              onClick={() => fetchData(currentBounds)}
            >
              Retry
            </button>
          </div>
        )}

        {/* Data visualization with optimized rendering */}
        {tab === "drone" ? (
          <HexGridVisualization
            mapRef={mapRef}
            points={visibleDronePoints}
            currentZoom={currentZoom}
            tab="drone"
          />
        ) : (
          <HexGridVisualization
            mapRef={mapRef}
            points={visibleAirSpacePoints}
            currentZoom={currentZoom}
            tab="air_space"
          />
        )}

        {/* Stats overlay with improved information */}
        <div className="absolute bottom-4 right-4 space-y-1 rounded-md bg-white bg-opacity-90 p-3 text-xs shadow-md dark:bg-zinc-800 dark:bg-opacity-90 dark:text-zinc-200">
          <div className="mb-1 border-b border-zinc-200 pb-1 text-sm font-semibold dark:border-zinc-700">
            Area Statistics
          </div>
          <div className="flex justify-between">
            {tab === "drone" && (
              <>
                <span>Visible drone points:</span>
                <span className="font-medium">
                  {visibleStats.droneCount.toLocaleString()}
                </span>
                )
              </>
            )}
          </div>
          <div className="flex justify-between">
            {tab === "air_space" && (
              <>
                <span>Visible air space points:</span>
                <span className="font-medium">
                  {visibleStats.airSpaceCount.toLocaleString()}
                </span>
              </>
            )}
          </div>
          <div className="flex justify-between">
            {tab === "both" && (
              <>
                <span>Total loaded drone points:</span>
                <span className="font-medium">
                  {visibleStats.totalDroneCount.toLocaleString()}
                </span>
              </>
            )}
          </div>
          <div className="flex justify-between">
            {tab === "both" && (
              <>
                <span>Total loaded air space points:</span>
                <span className="font-medium">
                  {visibleStats.totalAirSpaceCount.toLocaleString()}
                </span>
              </>
            )}
          </div>
          <div className="flex justify-between">
            <span>Zoom level:</span>
            <span className="font-medium">
              {Math.round(currentZoom * 10) / 10}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="font-medium">
              {loading ? "Loading data..." : "Ready"}
            </span>
          </div>
        </div>
      </ReactMap>

      {/* Enhanced Sidebar for point details */}
      {showSidebar && selectedHexId && (
        <Sidebar
          hexId={selectedHexId}
          pointData={typedSidebarData}
          pointCount={selectedHexPoints.length}
          pointType={selectedHexType}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
