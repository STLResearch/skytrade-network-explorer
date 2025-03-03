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
import { useDebounce } from "../hooks/useDebounce"
import {
  DronePoint,
  PropertyPoint,
  PointType,
  GeoBounds,
  TabType,
} from "@/types"

// Redux imports
import { useDispatch, useSelector } from "react-redux"
import { RootState, AppDispatch } from "@/store/store"
import { addDronePoints, addAirSpacePoints } from "@/store/geoDataSlice"
import { selectDronePoints, selectAirSpacePoints } from "@/store/selectors"

// Constants
const INITIAL_MAP_VIEW_STATE = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 4,
}
const MIN_MAP_ZOOM = 2
const MAX_MAP_ZOOM = 18
const MAP_CONTAINER_STYLE = { width: "100%", height: "100vh" }
const USA_BOUNDS: GeoBounds = {
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
    const [lat, lng] = h3.cellToLatLng(hexId)
    return [lng, lat]
  } catch (err) {
    console.error(`Error getting hex center for ${hexId}`, err)
    return [0, 0]
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

// Helper function to split large bounding boxes
function splitBoundsIfNeeded(bounds: GeoBounds, zoom: number): GeoBounds[] {
  if (zoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
    return [bounds]
  }
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const areaSize = latSpan * lngSpan

  if (zoom < 4 && areaSize > 400) {
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
    const midLat = (bounds.north + bounds.south) / 2
    const midLng = (bounds.east + bounds.west) / 2
    return [
      { north: bounds.north, south: midLat, east: midLng, west: bounds.west },
      { north: bounds.north, south: midLat, east: bounds.east, west: midLng },
      { north: midLat, south: bounds.south, east: midLng, west: bounds.west },
      { north: midLat, south: bounds.south, east: bounds.east, west: midLng },
    ]
  }
  return [bounds]
}

export function HexGridMap({ tab = "both" }: { tab?: TabType }) {
  const { resolvedTheme } = useTheme()
  const mapRef = useRef<MapRef>(null)
  const [cursor, setCursor] = useState<string>("")
  const [currentZoom, setCurrentZoom] = useState<number>(
    INITIAL_MAP_VIEW_STATE.zoom
  )
  const [currentBounds, setCurrentBounds] = useState<GeoBounds>(USA_BOUNDS)
  const [isMapIdle, setIsMapIdle] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedHexPoints, setSelectedHexPoints] = useState<PointType[]>([])
  const [selectedHexId, setSelectedHexId] = useState<string | null>(null)
  const [selectedHexType, setSelectedHexType] = useState<"drone" | "air_space">(
    "drone"
  )
  const [showSidebar, setShowSidebar] = useState<boolean>(false)

  // Redux hooks: useSelector to read and useDispatch to update the global cache.
  const dispatch = useDispatch<AppDispatch>()
  const dronePoints = useSelector(selectDronePoints)
  const airSpacePoints = useSelector(selectAirSpacePoints)

  // Debounce map move events to prevent too many API calls
  const debouncedBounds = useDebounce(currentBounds, 300)

  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol("basemaps", protocol.tile)
    return () => {
      maplibregl.removeProtocol("basemaps")
    }
  }, [])

  const mapStyle = useMemo(() => {
    const mapStyleString = JSON.stringify(st)
    return JSON.parse(mapStyleString)
  }, [])

  const prevZoomRef = useRef<number>(currentZoom)

  // Optimize which areas need data fetching based on bounds and zoom.
  const fetchAreasNeeded = useCallback(
    (
      bounds: GeoBounds,
      zoom: number,
      dataType: "drone" | "air_space",
      prevZoom: number
    ): GeoBounds[] => {
      const zoomDiff = Math.abs(zoom - prevZoom)
      const dataPoints =
        dataType === "drone" ? dronePoints.length : airSpacePoints.length
      if (zoomDiff < 1.5 && dataPoints > 0 && zoom > prevZoom) {
        return []
      }
      const splitBounds = splitBoundsIfNeeded(bounds, zoom)
      return splitBounds
    },
    [dronePoints.length, airSpacePoints.length]
  )

  // Optimized data fetching function
  const fetchData = useCallback(
    async (bounds: GeoBounds) => {
      if (!process.env.NEXT_PUBLIC_SKY_TRADE_API_URL) {
        console.error("API URL not set")
        setError("API URL not configured")
        return
      }
      if (!isMapIdle) return

      const shouldFetchDrone = tab === "drone" || tab === "both"
      const shouldFetchAirSpace = tab === "air_space" || tab === "both"
      const prevZoom = prevZoomRef.current

      const droneAreasToFetch = shouldFetchDrone
        ? fetchAreasNeeded(bounds, currentZoom, "drone", prevZoom)
        : []
      const airSpaceAreasToFetch = shouldFetchAirSpace
        ? fetchAreasNeeded(bounds, currentZoom, "air_space", prevZoom)
        : []

      if (droneAreasToFetch.length === 0 && airSpaceAreasToFetch.length === 0)
        return

      setLoading(true)
      setError(null)
      const fetchPromises: Promise<void>[] = []

      if (droneAreasToFetch.length > 0) {
        for (const area of droneAreasToFetch) {
          const fetchDronePromise = async () => {
            try {
              let droneEndpoint = `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/?maxLatitude=${area.north}&minLatitude=${area.south}&maxLongitude=${area.east}&minLongitude=${area.west}&limit=${MAX_POINTS_PER_REQUEST}`
              if (currentZoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
                droneEndpoint = droneEndpoint.concat("&detailLevel=high")
              }
              const droneResponse = await fetch(droneEndpoint)
              if (!droneResponse.ok) {
                throw new Error(`HTTP error! status: ${droneResponse.status}`)
              }
              const droneData: PointType[] = await droneResponse.json()
              // Dispatch action to add new drone points to Redux
              dispatch(addDronePoints(droneData))
            } catch (error) {
              console.error("Error fetching drone data:", error)
              throw error
            }
          }
          fetchPromises.push(fetchDronePromise())
        }
      }

      if (airSpaceAreasToFetch.length > 0) {
        for (const area of airSpaceAreasToFetch) {
          const fetchAirSpacePromise = async () => {
            try {
              let airSpaceEndpoint = `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/?maxLatitude=${area.north}&minLatitude=${area.south}&maxLongitude=${area.east}&minLongitude=${area.west}&limit=${MAX_POINTS_PER_REQUEST}`
              if (currentZoom >= MIN_ZOOM_FOR_FULL_DETAIL) {
                airSpaceEndpoint = airSpaceEndpoint.concat("&detailLevel=high")
              }
              const airSpaceResponse = await fetch(airSpaceEndpoint)
              if (!airSpaceResponse.ok) {
                throw new Error(
                  `HTTP error! status: ${airSpaceResponse.status}`
                )
              }
              const airSpaceData: PointType[] = await airSpaceResponse.json()
              dispatch(addAirSpacePoints(airSpaceData))
            } catch (error) {
              console.error("Error fetching airspace data:", error)
              throw error
            }
          }
          fetchPromises.push(fetchAirSpacePromise())
        }
      }

      try {
        await Promise.all(fetchPromises)
      } catch (error) {
        console.error("Error in data fetching:", error)
        setError("Failed to load map data. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [tab, currentZoom, isMapIdle, fetchAreasNeeded, dispatch]
  )

  useEffect(() => {
    fetchData(USA_BOUNDS)
  }, [fetchData])

  const previousBoundsRef = useRef<GeoBounds[]>([])

  const shouldFetchForBounds = useCallback((newBounds: GeoBounds): boolean => {
    if (previousBoundsRef.current.length === 0) return true
    for (const prevBounds of previousBoundsRef.current) {
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
      if (overlapArea / newArea > 0.85) return false
    }
    return true
  }, [])

  useEffect(() => {
    if (isMapIdle && debouncedBounds) {
      if (shouldFetchForBounds(debouncedBounds)) {
        fetchData(debouncedBounds)
        previousBoundsRef.current.push(debouncedBounds)
        if (previousBoundsRef.current.length > 10) {
          previousBoundsRef.current = previousBoundsRef.current.slice(-10)
        }
      }
    }
  }, [debouncedBounds, isMapIdle, fetchData, shouldFetchForBounds])

  // Filtering points using spatial binning remains the same.
  const visibleDronePoints = useMemo(() => {
    if (!currentBounds) return dronePoints
    if (dronePoints.length > 10000) {
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
      const resolution = Math.max(3, Math.min(6, Math.floor(currentZoom / 2)))
      const visibleHexes = new Set<string>()
      const latStep = (bufferedBounds.north - bufferedBounds.south) / 10
      const lngStep = (bufferedBounds.east - bufferedBounds.west) / 10
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
          } catch (err) {}
        }
      }
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
    if (airSpacePoints.length > 10000) {
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
      const resolution = Math.max(3, Math.min(6, Math.floor(currentZoom / 2)))
      const visibleHexes = new Set<string>()
      const latStep = (bufferedBounds.north - bufferedBounds.south) / 10
      const lngStep = (bufferedBounds.east - bufferedBounds.west) / 10
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
          } catch (err) {}
        }
      }
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

  const findPointsInHex = useCallback(
    (hexId: string, pointType: "drone" | "air_space"): PointType[] => {
      const points =
        pointType === "drone" ? visibleDronePoints : visibleAirSpacePoints
      return points.filter((point) => {
        const lat = point.latitude ?? point.deviceLocationLat
        const lng = point.longitude ?? point.deviceLocationLng
        if (lat === undefined || lng === undefined) return false
        try {
          const res = h3.getResolution(hexId)
          const pointHexId = h3.latLngToCell(lat, lng, res)
          return pointHexId === hexId
        } catch (err) {
          console.error("Error checking if point is in hex:", err)
          return false
        }
      })
    },
    [visibleDronePoints, visibleAirSpacePoints]
  )

  const handleMapMoveStart = useCallback(() => {
    setIsMapIdle(false)
  }, [])

  const handleMapMoveEnd = useCallback(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const bounds = map.getBounds()
    const newBounds: GeoBounds = {
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

  const [hexSelectionState, setHexSelectionState] = useState({
    isLoading: false,
    totalPoints: 0,
    loadedPoints: 0,
    hexId: null as string | null,
  })

  const emptyHexesRef = useRef<Set<string>>(new Set())

  const loadHexData = useCallback(
    async (hexId: string, type: "drone" | "air_space") => {
      if (!process.env.NEXT_PUBLIC_SKY_TRADE_API_URL) {
        console.error("API URL not set")
        return []
      }
      const hexCacheKey = `${hexId}-${type}`
      if (emptyHexesRef.current.has(hexCacheKey)) {
        return []
      }
      const pointsInHex = findPointsInHex(hexId, type)
      if (pointsInHex.length > 0 && pointsInHex.length >= 5) {
        return pointsInHex
      }
      try {
        const endpoint =
          type === "drone"
            ? `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/byHex/${hexId}`
            : `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/byHex/${hexId}`
        setHexSelectionState((prev) => ({ ...prev, isLoading: true, hexId }))
        const resolution = h3.getResolution(hexId)
        const hexBoundary = h3.cellToBoundary(hexId)
        const latitudes = hexBoundary.map(([lat]) => lat)
        const longitudes = hexBoundary.map(([_, lng]) => lng)
        const north = Math.max(...latitudes)
        const south = Math.min(...latitudes)
        const east = Math.max(...longitudes)
        const west = Math.min(...longitudes)
        const apiUrl =
          type === "drone"
            ? `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/droneRadar/?maxLatitude=${north}&minLatitude=${south}&maxLongitude=${east}&minLongitude=${west}&limit=500`
            : `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/properties/?maxLatitude=${north}&minLatitude=${south}&maxLongitude=${east}&minLongitude=${west}&limit=500`
        const response = await fetch(apiUrl)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const responseData: PointType[] = await response.json()
        const filteredPoints = responseData.filter((point) => {
          const lat = point.latitude ?? point.deviceLocationLat
          const lng = point.longitude ?? point.deviceLocationLng
          if (lat === undefined || lng === undefined) return false
          try {
            const pointHexId = h3.latLngToCell(lat, lng, resolution)
            return pointHexId === hexId
          } catch (err) {
            return false
          }
        })
        if (filteredPoints.length === 0) {
          emptyHexesRef.current.add(hexCacheKey)
        }
        const allPoints = [...pointsInHex]
        const existingIds = new Set(allPoints.map((p) => p.id))
        for (const point of filteredPoints) {
          if (!existingIds.has(point.id)) {
            allPoints.push(point)
            existingIds.add(point.id)
          }
        }
        if (type === "drone") {
          // Dispatching here is optional since we already added points during fetching.
          // You can choose to dispatch new points if needed.
        } else {
          // Same for air_space.
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
        return pointsInHex
      }
    },
    [findPointsInHex]
  )

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const hexFeatures = event.features?.filter(
        (f) => f.source?.startsWith("hex-source-") && f.properties?.hexId
      )
      if (hexFeatures && hexFeatures.length > 0) {
        const feature = hexFeatures[0]
        const hexId = feature.properties?.hexId
        const type = feature.properties?.type as "drone" | "air_space"
        const pointCount = feature.properties?.count || 0
        if (hexId) {
          const initialPoints = findPointsInHex(hexId, type)
          setSelectedHexPoints(initialPoints)
          setSelectedHexId(hexId)
          setSelectedHexType(type)
          setShowSidebar(true)
          const resolution = h3.getResolution(hexId)
          const shouldFetchDetails =
            (pointCount > 5 && initialPoints.length < pointCount / 2) ||
            resolution >= 7
          if (shouldFetchDetails) {
            loadHexData(hexId, type).then((fullPoints) => {
              setSelectedHexPoints(fullPoints)
            })
          }
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
        setShowSidebar(false)
      }
    },
    [findPointsInHex, currentZoom, loadHexData]
  )

  const handleMouseEnter = useCallback(() => setCursor("pointer"), [])
  const handleMouseLeave = useCallback(() => setCursor(""), [])
  const handleClose = useCallback(() => setShowSidebar(false), [])

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

  const typedSidebarData = useMemo(() => {
    if (selectedHexType === "drone") {
      return selectedHexPoints.map(convertToDronePoint)
    } else {
      return selectedHexPoints.map(convertToPropertyPoint)
    }
  }, [selectedHexPoints, selectedHexType])

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

        {loading && (
          <div className="absolute right-4 top-4 z-10 flex items-center space-x-2 rounded-md bg-white bg-opacity-80 px-3 py-2 shadow-md dark:bg-zinc-800 dark:bg-opacity-80 dark:text-zinc-200">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent dark:border-blue-400"></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Loading data...
            </span>
          </div>
        )}

        {error && (
          <div className="absolute left-1/2 top-1/2 z-50 flex w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 transform items-center space-x-2 rounded-md border border-red-400 bg-red-100 px-6 py-3 text-red-700 shadow-lg dark:border-red-700 dark:bg-red-900/50 dark:text-red-300">
            <svg
              className="h-6 w-6 text-red-500 dark:text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="flex-1 text-sm">{error}</span>
            <button
              className="rounded-md bg-red-200 px-3 py-1.5 text-xs text-red-800 hover:bg-red-300 dark:bg-red-800 dark:text-red-200 dark:hover:bg-red-700"
              onClick={() => fetchData(currentBounds)}
            >
              Retry
            </button>
          </div>
        )}

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
