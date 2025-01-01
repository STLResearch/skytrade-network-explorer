"use client"

import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Protocol } from "pmtiles"

import { cellToLatLng, cellsToMultiPolygon, getResolution } from "h3-js"
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

import Sidebar from "../sidebar/index"
import { st } from "../../styles/mapStyle"

export function HotspotsMap({ tab }: { tab: "drone" | "radar" }) {
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

  // const mapStyleString = JSON.stringify(st)
  // const mapStyleObject = JSON.parse(mapStyleString)
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
        <NetworkCoverageLayer layer={networkLayers.customDrone} />
      )}
      {/* <NetworkCoverageLayer layer={networkLayers.custom} /> */}
      {currentTab === "radar" && (
        <NetworkCoverageLayer layer={networkLayers.custom} />
      )}

      {selectedHex && (
        <Source type="geojson" data={selectedHex.geojson}>
          <Layer type="line" paint={getHexOutlineStyle(resolvedTheme)} />
        </Source>
      )}
    </Map>
  )
}
