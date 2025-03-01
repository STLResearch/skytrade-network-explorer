"use client"

import React, { useState, useCallback, useRef } from "react"
import { useTheme } from "next-themes"
import maplibregl from "maplibre-gl"
import { Protocol } from "pmtiles"
import ReactMap, {
  MapRef,
  Layer,
  Source,
  NavigationControl,
  MapLayerMouseEvent,
} from "react-map-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import Sidebar from "./sidebar/index"
import { useMapData } from "../hooks/useMapData"
import { Feature } from "geojson"
import { st } from "../styles/mapStyle"

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

// Types
type TabType = "drone" | "air_space"
type PointType = {
  id: string
  title?: string
  userId?: string
  deviceLocationLat?: number
  deviceLocationLng?: number
  latitude?: number
  longitude?: number
  address?: string
  price?: number
  isRentableAirspace?: boolean
}

export function MapExplorer({ tab = "drone" }: { tab?: TabType }) {
  // Theme
  const { resolvedTheme } = useTheme()

  // Refs
  const mapRef = useRef<MapRef>(null)

  // State
  const [cursor, setCursor] = useState<string>("")
  const [currentZoom, setCurrentZoom] = useState<number>(
    INITIAL_MAP_VIEW_STATE.zoom
  )
  const [selectedPoint, setSelectedPoint] = useState<{
    id: string
    name: string
    price?: number
  } | null>(null)

  // Data conversion functions
  const convertDroneDataToGeoJSON = useCallback(
    (data: PointType[]): Feature[] => {
      return data
        .filter(
          (device) =>
            device.deviceLocationLat != null && device.deviceLocationLng != null
        )
        .map(
          (device): Feature => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [
                device.deviceLocationLng!,
                device.deviceLocationLat!,
              ],
            },
            properties: {
              id: device.id,
              name: device.userId || device.title || device.id,
              type: "drone",
            },
          })
        )
    },
    []
  )

  const convertPropertyDataToGeoJSON = useCallback(
    (data: PointType[]): Feature[] => {
      return data
        .filter((prop) => prop.latitude != null && prop.longitude != null)
        .map(
          (prop): Feature => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [prop.longitude!, prop.latitude!],
            },
            properties: {
              id: prop.id,
              name: prop.address || "Property",
              price: prop.price,
              isRentableAirspace: prop.isRentableAirspace,
              type: "property",
            },
          })
        )
    },
    []
  )

  // Use the map data hook
  const {
    loading,
    error,
    data: pointsData,
    loadingCells,
    failedCells,
    loadBounds,
    retryFailedCells,
  } = useMapData({
    dataType: tab === "drone" ? "drone" : "air_space",
    initialBounds: USA_BOUNDS,
    apiBaseUrl: process.env.NEXT_PUBLIC_SKY_TRADE_API_URL || "",
    convertToGeoJSON:
      tab === "drone"
        ? convertDroneDataToGeoJSON
        : convertPropertyDataToGeoJSON,
  })

  // Initialize maplibre protocol
  React.useEffect(() => {
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

  // Layer styling
  const layers = React.useMemo(() => {
    const primaryColor = tab === "drone" ? "#11b4da" : "#da7111"
    const clusterColors =
      tab === "drone"
        ? ["#B0E6F1", "#71BBD4", "#478E9B"]
        : ["#F1B0B0", "#D47171", "#9B4747"]

    return {
      // Heatmap for low zoom levels
      heatmap: {
        id: "points-heat",
        type: "heatmap",
        source: "points",
        maxzoom: 9,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["zoom"], 0, 0.1, 9, 1],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            9,
            3,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0, 0, 255, 0)",
            0.2,
            tab === "drone"
              ? "rgba(0, 255, 255, 0.5)"
              : "rgba(255, 128, 0, 0.5)",
            0.4,
            tab === "drone"
              ? "rgba(0, 128, 255, 0.7)"
              : "rgba(255, 64, 0, 0.7)",
            0.6,
            tab === "drone" ? "rgba(0, 64, 255, 0.8)" : "rgba(255, 0, 0, 0.8)",
            0.8,
            tab === "drone" ? "rgb(0, 0, 255)" : "rgb(200, 0, 0)",
            1,
            tab === "drone" ? "rgb(0, 0, 192)" : "rgb(150, 0, 0)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0],
        },
      },

      // Point clusters
      clusterCircle: {
        id: "cluster-circle",
        type: "circle",
        source: "points",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            100,
            30,
            750,
            40,
          ],
          "circle-color": [
            "step",
            ["get", "point_count"],
            clusterColors[0],
            100,
            clusterColors[1],
            750,
            clusterColors[2],
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      },

      clusterCount: {
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
      },

      // Individual points
      unclusteredPoint: {
        id: "unclustered-point",
        type: "circle",
        source: "points",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            2,
            14,
            5,
            18,
            10,
          ],
          "circle-color": primaryColor,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8,
            0.6,
            14,
            1,
          ],
        },
      },
    }
  }, [tab])

  // Map event handlers
  const handleMapMoveEnd = useCallback(() => {
    if (!mapRef.current) return

    const map = mapRef.current.getMap()
    const bounds = map.getBounds()
    const zoom = map.getZoom()

    // Update current zoom
    setCurrentZoom(zoom)

    // Load data for current bounds
    loadBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }, [loadBounds])

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features && event.features[0]
    if (!feature) return

    const isCluster = feature.properties?.cluster
    if (isCluster) {
      // Handle cluster click - zoom in
      const clusterId = feature.properties?.cluster_id
      const mapboxSource = mapRef.current?.getMap().getSource("points") as any

      if (mapboxSource && clusterId) {
        mapboxSource.getClusterExpansionZoom(
          clusterId,
          (err: any, zoom: number) => {
            if (err) return

            mapRef.current?.flyTo({
              center: event.lngLat,
              zoom: zoom + 1,
              duration: 500,
            })
          }
        )
      }
    } else {
      // Handle point click - show details
      const clickedId = feature.properties?.id
      const clickedName = feature.properties?.name
      const clickedPrice = feature.properties?.price

      setSelectedPoint({
        id: clickedId,
        name: clickedName,
        price: clickedPrice,
      })
    }
  }, [])

  const handleMouseEnter = useCallback(() => setCursor("pointer"), [])
  const handleMouseLeave = useCallback(() => setCursor(""), [])
  const handleClose = useCallback(() => setSelectedPoint(null), [])

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
        interactiveLayerIds={["cluster-circle", "unclustered-point"]}
        onMoveEnd={handleMapMoveEnd}
        onZoomEnd={handleMapMoveEnd}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor={cursor}
        ref={mapRef}
        attributionControl={false}
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-4 top-4 flex items-center space-x-2 rounded-md bg-white bg-opacity-80 px-3 py-2 shadow-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-gray-700">
              Loading data ({loadingCells.size} cells remaining)
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 transform items-center space-x-2 rounded-md border border-red-400 bg-red-100 px-4 py-2 text-red-700 shadow-md">
            <svg
              className="h-5 w-5 text-red-500"
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
              className="ml-2 rounded-md bg-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-300"
              onClick={retryFailedCells}
            >
              Retry
            </button>
          </div>
        )}

        {/* Data display */}
        <Source
          id="points"
          type="geojson"
          data={pointsData}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {/* Layers */}
          <Layer {...(layers.heatmap as any)} />
          <Layer {...(layers.clusterCircle as any)} />
          <Layer {...(layers.clusterCount as any)} />
          <Layer {...(layers.unclusteredPoint as any)} />
        </Source>

        {/* Stats overlay */}
        <div className="absolute bottom-4 right-4 rounded-md bg-white bg-opacity-90 p-2 text-xs shadow-md">
          <div>Points loaded: {pointsData.features.length}</div>
          <div>Zoom level: {Math.round(currentZoom * 10) / 10}</div>
          <div>Data type: {tab === "drone" ? "Drone Radar" : "Air Spaces"}</div>
          {failedCells.size > 0 && (
            <div className="text-red-500">Failed cells: {failedCells.size}</div>
          )}
        </div>
      </ReactMap>

      {/* Sidebar for details */}
      {selectedPoint && (
        <Sidebar
          hexId={selectedPoint.id}
          propertyName={selectedPoint.name}
          price={selectedPoint.price}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
