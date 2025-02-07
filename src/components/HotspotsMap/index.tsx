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
import Map, {
  Layer,
  MapLayerMouseEvent,
  MapRef,
  MapStyle,
  NavigationControl,
  Source,
} from "react-map-gl"
import { gaEvent } from "../GATracker"
import { NetworkCoverageLayer } from "./NetworkCoverageLayer"
import { mapLayersDark } from "./mapLayersDark"
import { mapLayersLight } from "./mapLayersLight"
import {
  HexFeatureDetails,
  INITIAL_MAP_VIEW_STATE,
  MAP_CONTAINER_STYLE,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  ZOOM_BY_HEX_RESOLUTION,
  getHexOutlineStyle,
  networkLayers,
} from "./utils"
import { Feature, FeatureCollection, Geometry } from "geojson"

import Sidebar from "../sidebar/index"
import { st } from "../../styles/mapStyle"
import Point from "./types"
export function HotspotsMap({ tab }: { tab: "drone" | "air_space" }) {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSelectedLayoutSegments()
  const segment = useSelectedLayoutSegment()
  const mapRef = useRef<MapRef>(null)
  const [selectedHex, setSelectedHex] = useState<HexFeatureDetails | null>(null)
  const [cursor, setCursor] = useState("")
  const [currentTab, setCurrentTab] = useState(tab)
  const [showPopup, setShowPopup] = useState(false)
  const [selectedHexId, setSelectedHexId] = useState("")
  const [mapLoaded, setMapLoaded] = useState(false)

  const [pointsData, setPointsData] = useState<FeatureCollection>()
  const [hexesData, setHexesData] = useState<FeatureCollection>()

  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol("basemaps", protocol.tile)
    return () => {
      maplibregl.removeProtocol("basemaps")
    }
  }, [])
  console.log("map rendering")

  const mapStyle = useMemo(() => {
    const style: MapStyle = {
      version: 8,
      sources: {
        carto: {
          type: "vector",
          url: "https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json",
        },
      },
      glyphs: "https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf",
      sprite:
        "https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/sprite",
      layers: mapLayersDark,
    }
    return style
  }, [resolvedTheme])

  const newMapStyle = useMemo(() => {
    const mapStyleString = JSON.stringify(st)
    const mapStyleObject = JSON.parse(mapStyleString)
    return mapStyleObject
  }, [resolvedTheme])
  const selectHex = useCallback((hexId: string | null) => {
    if (!hexId) {
      setSelectedHex(null)
      return
    }

    const selectedHex = {
      hexId,
      geojson: {
        type: "MultiPolygon",
        coordinates: cellsToMultiPolygon([hexId], true),
      } as GeoJSON.Geometry,
    }

    setSelectedHex(selectedHex)

    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const [lat, lng] = cellToLatLng(hexId)
    const bounds = map.getBounds()
    const zoom = map.getZoom()
    const hexResolution = getResolution(hexId)
    const newZoom = ZOOM_BY_HEX_RESOLUTION[hexResolution]
    if (zoom < newZoom - 3 || !bounds.contains([lng, lat])) {
      // Fly to the hex if it's not visible in the current viewport, or if it's not zoomed in enough
      // TODO uncomment this after
      // map.flyTo({ center: [lng, lat], zoom: newZoom })
    }
  }, [])

  const selectHexByPathname = useCallback(() => {
    if (!mapRef.current) return
    console.log(mapRef)
    if (segments.length === 2 && segments[0] === "hex") {
      const hexId = segments[1]
      if (selectedHex?.hexId !== hexId) {
        selectHex(hexId)
      }
    } else if (pathname === "/" && selectedHex?.hexId) {
      selectHex(null)
    }
  }, [pathname, segments, selectHex, selectedHex?.hexId])

  useEffect(() => {
    setMapLoaded(true)
    selectHexByPathname()
  }, [selectHexByPathname])

  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      event.features?.forEach(({ layer, properties }) => {
        if (layer.id !== "hexes_layer" || !properties?.id) return
        // if (selectedHex?.hexId === properties.id) {
        //   // router.push("/radar")
        // } else {
        //   // router.push(`/radar/hex/8c3dac39da5c5ff`)
        // }
        setSelectedHexId(properties.id)
        console.log("clicked " + properties.id)
        setShowPopup(!showPopup)
      })
    },
    [router, selectedHex?.hexId]
  )

  useEffect(() => {
    gaEvent({ action: "map_load" })
  }, [])

  const onMouseEnter = useCallback(() => setCursor("pointer"), [])
  const onMouseLeave = useCallback(() => setCursor(""), [])

  const handleClose = useCallback(() => {
    console.log("close")
    setShowPopup(false)
  }, [])

  interface Bounds {
    north: number
    south: number
    east: number
    west: number
  }

  // interface Point {
  //   longitude: number;
  //   latitude: number;
  // }

  // interface GeoJSONFeature {
  //   type: string;
  //   geometry: {
  //     type: string;
  //     coordinates: number[];
  //   };
  //   properties: {
  //     id: string;
  //     name: string;
  //   };
  // }
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
  let lastBounds: Bounds

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

  const shouldFetch = (newBounds: Bounds, oldBounds: Bounds) => {
    if (!oldBounds) return true

    const oldArea = calculateArea(oldBounds)
    const intersectionArea = calculateIntersectionArea(oldBounds, newBounds)
    const hasTwoBoundsOutside = isOutOfTwoBounds(oldBounds, newBounds)
    return intersectionArea <= oldArea / 2 && hasTwoBoundsOutside
  }

  const fetchPointsData = useCallback(async (bounds: Bounds) => {
    console.log("try fetching points")
    console.log(bounds)
    if (bounds.north - bounds.south > 24 || !shouldFetch(bounds, lastBounds)) {
      return
    }
    lastBounds = bounds
    try {
      console.log("fetching")
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SKY_TRADE_API_URL}/${
          tab === "drone" ? "droneRadar" : "properties"
        }/?maxLatitude=${bounds.north}&minLatitude=${
          bounds.south
        }&maxLongitude=${bounds.east}&minLongitude=${bounds.west}`
      )
      console.log(response)
      const data: Point[] = await response.json()
      console.log(data)
      // return
      // Convert data to GeoJSON format
      const pointsGeoJSON: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: data.map(
          (point: Point, index: number): GeoJSONFeature => ({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [point.longitude, point.latitude],
            },
            properties: {
              id: point.id.toString(),
              name: point.title,
            },
          })
        ),
      }

      const hexesGeoJSON: FeatureCollection = {
        type: "FeatureCollection",
        features: data.map((point: any, index: number) => {
          // const hexagonIndex = latLngToCell(point.latitude, point.longitude, RESOLUTION);
          // const hexagonBoundary = cellsToMultiPolygon([hexagonIndex], true);
          // console.log(hexagonBoundary)
          // get all the points in of vertex in map
          const coordinates = point.vertexes?.map((vertex: any) => [
            vertex.longitude,
            vertex.latitude,
          ])
          console.log(coordinates)
          // if (coordinates.length > 0 && coordinates[0] !== coordinates[coordinates.length - 1]) {
          //   coordinates.push(coordinates[0]);
          // }
          return {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
            properties: {
              id: point.id,
              name: point.title,
            },
          }
        }),
      }

      setPointsData(pointsGeoJSON)
      setHexesData(hexesGeoJSON)
    } catch (error) {
      console.error("Error fetching data:", error)
    }
  }, [])

  const debounce = (func: any, delay = 300) => {
    let timeout: any
    return (...args: any) => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        func(...args)
      }, delay)
    }
  }

  const handleMapMoveEnd = useCallback(
    debounce(() => {
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
    }, 300),
    [fetchPointsData]
  )
  return (
    <Map
      initialViewState={INITIAL_MAP_VIEW_STATE}
      minZoom={MIN_MAP_ZOOM}
      maxZoom={MAX_MAP_ZOOM}
      style={MAP_CONTAINER_STYLE}
      mapStyle={newMapStyle}
      localFontFamily="NotoSans-Regular"
      // @ts-ignore
      mapLib={maplibregl}
      interactiveLayerIds={["hexes_layer"]}
      onLoad={selectHexByPathname}
      onMoveEnd={handleMapMoveEnd}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      cursor={cursor}
      ref={mapRef}
      attributionControl={false}
    >
      <NavigationControl position="bottom-left" showCompass={false} />

      {showPopup && <Sidebar hexId={selectedHexId} onClose={handleClose} />}
      {/* {segment !== "mobile" && (
        <NetworkCoverageLayer layer={networkLayers.iot} />
      )} */}
      {currentTab === "drone" && (
        <NetworkCoverageLayer
          layer={networkLayers.customDrone}
          data={{ hexesData, pointsData }}
        />
      )}
      {/* <NetworkCoverageLayer layer={networkLayers.custom} /> */}
      {currentTab === "air_space" && (
        <NetworkCoverageLayer
          layer={networkLayers.custom}
          data={{ hexesData, pointsData }}
        />
      )}

      {selectedHex && (
        <Source type="geojson" data={selectedHex.geojson}>
          <Layer type="line" paint={getHexOutlineStyle(resolvedTheme)} />
        </Source>
      )}
    </Map>
  )
}
