"use client"

import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"

import {
  cellToLatLng,
  cellsToMultiPolygon,
  getResolution,
  latLngToCell,
} from "h3-js"
import { useTheme } from "next-themes"
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegment,
  useSelectedLayoutSegments,
} from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMap, {
  Layer,
  MapLayerMouseEvent,
  MapRef,
  MapStyle,
  NavigationControl,
  Source,
} from "react-map-gl"
import { gaEvent } from "../GATracker"
import { NetworkCoverageLayer } from "./NetworkCoverageLayer"

import {
  HEX_RESOLUTION,
  HexFeatureDetails,
  INITIAL_MAP_VIEW_STATE,
  MAP_CONTAINER_STYLE,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  ZOOM_BY_HEX_RESOLUTION,
  getHexOutlineStyle,
  networkLayers,
} from "./utils"
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson"

import Sidebar from "../sidebar/index"
import { st } from "../../styles/mapStyle"
import Point from "./types"
import { LoadingIcon } from "../icons/LoadingIcon"

const pointToHexFeature = (point: Point): GeoJSON.Feature => {
  const hexId = latLngToCell(point.latitude, point.longitude, HEX_RESOLUTION)
  const hexPolygons = cellsToMultiPolygon([hexId], true)
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: hexPolygons[0],
    },
    properties: {
      id: point.id,
      name: point.title,
    },
  }
}

export function HotspotsMap({ tab }: { tab: "drone" | "air_space" }) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSelectedLayoutSegments()
  const segment = useSelectedLayoutSegment()
  const mapRef = useRef<MapRef>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [selectedHex, setSelectedHex] = useState<HexFeatureDetails | null>(null)

  const [propertyName, setPropertyName] = useState("")
  const [cursor, setCursor] = useState("")
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [currentTab, setCurrentTab] = useState(tab)
  const [showPopup, setShowPopup] = useState(false)

  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(
    undefined
  )

  const emptyGeoJSON: FeatureCollection<Geometry, GeoJsonProperties> = {
    type: "FeatureCollection",
    features: [],
  }

  const [pointsData, setPointsData] = useState<FeatureCollection>(emptyGeoJSON)
  const [hexesData, setHexesData] = useState<FeatureCollection>()

  // Define cluster layers dynamically based on the `tab` prop

  const clusterCircleLayer = useMemo(
    () => ({
      id: "cluster-circle",
      type: "circle",
      source: "points",
      filter: ["has", "point_count"],
      paint: {
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
        "circle-color":
          tab === "drone"
            ? [
                "step",
                ["get", "point_count"],
                "#B0E6F1",
                100,
                "#71BBD4",
                750,
                "#478E9B",
              ]
            : [
                "step",
                ["get", "point_count"],
                "#F1B0B0",
                100,
                "#D47171",
                750,
                "#9B4747",
              ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff",
      },
    }),
    [tab]
  )

  const clusterCountLayer = useMemo(
    () => ({
      id: "cluster-count",
      type: "symbol",
      source: "points",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": tab === "drone" ? "#000" : "#fff",
      },
    }),
    [tab]
  )

  const unclusteredPointLayer = useMemo(
    () => ({
      id: "unclustered-point",
      type: "circle",
      source: "points",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 5,
        "circle-color": tab === "drone" ? "#11b4da" : "#da7111",
        "circle-stroke-width": 1,
        "circle-stroke-color": "#fff",
      },
    }),
    [tab]
  )

  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol("basemaps", protocol.tile)
    return () => {
      maplibregl.removeProtocol("basemaps")
    }
  }, [])

  const newMapStyle = useMemo(() => {
    const mapStyleString = JSON.stringify(st)
    const mapStyleObject = JSON.parse(mapStyleString)
    return mapStyleObject
  }, [])

  useEffect(() => {
    gaEvent({ action: "map_load" })
  }, [])

  interface Bounds {
    north: number
    south: number
    east: number
    west: number
  }

  type GeoJSONFeature = Feature<Geometry, { id: string; name: string }>
  interface HexFeature {
    type: string
    geometry: {
      type: string
      coordinates: number[][][]
    }
    properties: {
      id: string
      name: string
    }
  }

  const lastBoundsRef = useRef<Bounds | null>(null)

  const shouldFetch = useCallback((newBounds: Bounds, oldBounds: Bounds) => {
    if (!oldBounds) return true

    const calculateIntersectionArea = (prev: Bounds, curr: Bounds) => {
      const xOverlap = Math.max(
        0,
        Math.min(prev.east, curr.east) - Math.max(prev.west, curr.west)
      )
      const yOverlap = Math.max(
        0,
        Math.min(prev.north, curr.north) - Math.max(prev.south, curr.south)
      )
      return xOverlap * yOverlap
    }

    const calculateArea = (bounds: Bounds) => {
      return (bounds.east - bounds.west) * (bounds.north - bounds.south)
    }

    const isOutOfTwoBounds = (prev: Bounds, curr: Bounds) => {
      let count = 0

      if (curr.north > prev.north || curr.north < prev.south) count++
      if (curr.south < prev.south || curr.south > prev.north) count++
      if (curr.east > prev.east || curr.east < prev.west) count++
      if (curr.west < prev.west || curr.west > prev.east) count++

      return count >= 2
    }

    const oldArea = calculateArea(oldBounds)
    const intersectionArea = calculateIntersectionArea(oldBounds, newBounds)
    const hasTwoBoundsOutside = isOutOfTwoBounds(oldBounds, newBounds)
    return intersectionArea <= oldArea / 2 && hasTwoBoundsOutside
  }, [])

  // Conversion function for drone data (from Device model)
  const convertDroneDataToGeoJSON = (
    data: any[]
  ): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: data
        .filter(
          (device) =>
            device.deviceLocationLat != null && device.deviceLocationLng != null
        )
        .map((device) => {
          const coordinates = [
            device.deviceLocationLng,
            device.deviceLocationLat,
          ]
          // Try to extract a name from remoteData if possible.
          let name = device.id // default: use the device id
          if (device.remoteData && typeof device.remoteData === "object") {
            // If remoteData has a 'name' property, use that.
            const remote = device.remoteData as { name?: string }
            if (remote.name) {
              name = remote.name
            }
          }
          return {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates,
            },
            properties: {
              id: device.id,
              name, // either the remoteData name or fallback to id
              // ipAddress: device.ipAddress,
              // Optionally include other properties
            },
          }
        }),
    }
  }

  const convertPropertyDataToGeoJSON = (
    data: any[]
  ): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: data
        .filter((prop) => prop.latitude != null && prop.longitude != null)
        .map((prop) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [prop.longitude, prop.latitude],
          },
          properties: {
            id: prop.id ? prop.id.toString() : "",
            name: prop.address || "Property",
            price: prop.price,
            isRentableAirspace: prop.isRentableAirspace,
          },
        })),
    }
  }

  const fetchPointsData = useCallback(
    async (bounds: Bounds) => {
      if (
        bounds.north - bounds.south > 30 ||
        (lastBoundsRef.current !== null &&
          !shouldFetch(bounds, lastBoundsRef.current))
      ) {
        return
      }
      lastBoundsRef.current = bounds
      try {
        setLoading(true)
        setFetchError(null)

        const endpoint = tab === "drone" ? "droneRadar" : "properties"

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/${endpoint}/?maxLatitude=${bounds.north}&minLatitude=${bounds.south}&maxLongitude=${bounds.east}&minLongitude=${bounds.west}`
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: Point[] = await response.json()

        let pointsGeoJSON: GeoJSON.FeatureCollection
        if (tab === "drone") {
          pointsGeoJSON = convertDroneDataToGeoJSON(data)
        } else {
          pointsGeoJSON = convertPropertyDataToGeoJSON(data)
        }

        setPointsData(pointsGeoJSON)
      } catch (error) {
        console.error("Error fetching data:", error)
        setFetchError("Failed to load map data. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [tab, shouldFetch]
  )

  const debounce = (func: any, delay = 300) => {
    let timeout: any
    return (...args: any) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        func(...args)
      }, delay)
    }
  }

  const debouncedFetchPointsData = useMemo(
    () =>
      debounce((boundsData: Bounds) => {
        fetchPointsData(boundsData)
      }, 300),
    [fetchPointsData]
  )

  const handleMapMoveEnd = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap()
      const bounds = map.getBounds()
      const boundsData = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      }
      debouncedFetchPointsData(boundsData)
    }
  }, [debouncedFetchPointsData])

  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features && event.features[0]
      if (!feature) return

      const isCluster = feature.properties?.cluster
      if (isCluster) {
        const clusterId = feature.properties?.cluster_id
        const mapboxSource = mapRef.current?.getMap().getSource("points") as any
        if (mapboxSource && clusterId) {
          mapboxSource.getClusterExpansionZoom(
            clusterId,
            (err: any, zoom: number) => {
              if (err) {
                return
              }
              mapRef.current?.flyTo({
                center: event.lngLat,
                zoom: zoom + 1,
              })
            }
          )
        }
      } else {
        const clickedId = feature.properties?.id
        const clickedName = feature.properties?.name
        const clickedPrice = feature.properties?.price ?? null
        setSelectedPointId(clickedId)
        setPropertyName(clickedName)
        setSelectedPrice(clickedPrice)
        setShowPopup(!showPopup)
      }
    },
    [showPopup]
  )

  const onMouseEnter = useCallback(() => setCursor("pointer"), [])
  const onMouseLeave = useCallback(() => setCursor(""), [])

  const handleClose = useCallback(() => {
    setShowPopup(false)
  }, [])

  return (
    <ReactMap
      initialViewState={INITIAL_MAP_VIEW_STATE}
      minZoom={MIN_MAP_ZOOM}
      maxZoom={MAX_MAP_ZOOM}
      style={MAP_CONTAINER_STYLE}
      mapStyle={newMapStyle}
      localFontFamily="NotoSans-Regular"
      // @ts-ignore
      mapLib={maplibregl}
      onLoad={() => {
        // fetch initial data or handle first load
        if (mapRef.current) {
          const map = mapRef.current.getMap()
          const bounds = map.getBounds()
          fetchPointsData({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          })
        }
      }}
      interactiveLayerIds={[
        "cluster-circle",
        "cluster-count",
        "unclustered-point",
      ]}
      onMoveEnd={handleMapMoveEnd}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor={cursor}
      ref={mapRef}
      attributionControl={false}
    >
      <NavigationControl position="bottom-left" showCompass={false} />

      {loading && (
        <div className="absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-1/2 transform">
          <svg
            className="h-16 w-16 animate-spin text-blue-500"
            viewBox="0 0 50 50"
            style={{ animationDuration: "1s" }}
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="100"
              strokeDashoffset="75"
            />
          </svg>
        </div>
      )}

      {fetchError && (
        <div className="absolute left-1/2 top-1/4 z-[1000] -translate-x-1/2 transform rounded bg-red-600 px-4 py-3 text-center text-white">
          <p>{fetchError}</p>
          <button
            className="mt-2 rounded bg-white px-4 py-2 text-red-600 hover:bg-gray-100"
            onClick={() => {
              if (mapRef.current) {
                const map = mapRef.current.getMap()
                const bounds = map.getBounds()
                const boundsData = {
                  north: bounds.getNorth(),
                  south: bounds.getSouth(),
                  east: bounds.getEast(),
                  west: bounds.getWest(),
                }
                fetchPointsData(boundsData)
              }
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* {showPopup && (
        <Sidebar
          hexId={selectedPointId ?? ""}
          price={selectedPrice}
          propertyName={propertyName}
          onClose={handleClose}
        />
      )} */}

      <Source
        id="points"
        type="geojson"
        data={pointsData}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer {...(clusterCircleLayer as any)} />
        <Layer {...(clusterCountLayer as any)} />
        <Layer {...(unclusteredPointLayer as any)} />
      </Source>
    </ReactMap>
  )
}
