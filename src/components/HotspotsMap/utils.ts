import { CoordPair, cellsToMultiPolygon } from "h3-js"
import * as h3 from "h3-js"
import { HeliumIotIcon } from "../icons/HeliumIotIcon"
import { HeliumMobileIcon } from "../icons/HeliumMobileIcon"

export const MIN_MAP_ZOOM = 2
export const MAX_MAP_ZOOM = 10

const WORLD_BOUNDS: [CoordPair, CoordPair] = [
  [-134.827109, 57.785781],
  [129.767893, -30.955724],
]

export const INITIAL_MAP_VIEW_STATE = {
  bounds: WORLD_BOUNDS,
}

export const MAP_CONTAINER_STYLE: React.CSSProperties = {
  height: "100%",
  width: "100%",
  overflow: "hidden",
  position: "relative",
  backgroundColor: "rgb(20, 20, 20)",
}

export const MIN_HEXES_ZOOM = 5
export const MIN_HEX_LABELS_ZOOM = 11
export const POINTS_AND_HEXES_OVERLAP = 2

export const HELIUM_IOT_COLOR = "#27EE76"
export const HELIUM_MOBILE_COLOR = "#009FF9"

const h3Indexes = ["89283082813ffff", "8928308281bffff"]
// this is for testing actual data will come from api remove this once api set
// Sample data structure for custom points
// console.log(h3.cellToLatLng(h3Indexes[0]))
// export const samplePointsData = {
//   type: "FeatureCollection",
//   features: [
//     {
//       type: "Feature",
//       geometry: {
//         type: "Point",
//         coordinates: h3.cellToLatLng(h3Indexes[0])
//       },
//       properties: {
//         id: "sample-point-1",
//         name: "Sample Point 1"
//       }
//     },
//     {
//       type: "Feature",
//       geometry: {
//         type: "Point",
//         coordinates: h3.cellToLatLng(h3Indexes[1])
//       },
//       properties: {
//         id: "sample-point-2",
//         name: "Sample Point 2"
//       }
//     }
//   ]
// };

// // Sample data structure for custom hexes

// export const sampleHexesData = {
//   type: "FeatureCollection",
//   features: [
//     {
//       type: "Feature",
//       geometry: {
//         type: "MultiPolygon",
//         coordinates: cellsToMultiPolygon(h3Indexes, true)
//       },
//       properties: {

//       }
//     }
//   ]
// };

export const samplePointsData = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [77.4126, 23.2599], // Bhopal
      },
      properties: {
        id: "point1",
        name: "Sample Point 1",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [78.4126, 25.2599], // Jaipur
      },
      properties: {
        id: "point2",
        name: "Sample Point 2",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [72.8777, 19.076], // Mumbai
      },
      properties: {
        id: "point3",
        name: "Sample Point 3",
      },
    },
    // {
    //   type: "Feature",
    //   geometry: {
    //     type: "Point",
    //     coordinates: [77.1025, 28.7041] // Delhi
    //   },
    //   properties: {
    //     id: "point4",
    //     name: "Sample Point 4"
    //   }
    // },
    // {
    //   type: "Feature",
    //   geometry: {
    //     type: "Point",
    //     coordinates: [88.3639, 22.5726] // Kolkata
    //   },
    //   properties: {
    //     id: "point5",
    //     name: "Sample Point 5"
    //   }
    // }
  ],
}

// Sample data structure for custom hexes
export const sampleHexesData = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [77.4126, 23.2599], // Bhopal
              [77.4136, 23.2609],
              [77.4146, 23.2609],
              [77.4156, 23.2599],
              [77.4146, 23.2589],
              [77.4136, 23.2589],
              [77.4126, 23.2599],
            ],
          ],
        ],
      },
      properties: {
        id: "89283082813ffff",
        count: 10,
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [78.4126, 25.2599], // Jaipur
              [78.4136, 25.2609],
              [78.4146, 25.2609],
              [78.4156, 25.2599],
              [78.4146, 25.2589],
              [78.4136, 25.2589],
              [78.4126, 25.2599],
            ],
          ],
        ],
      },
      properties: {
        id: "89283082813ffff",
        count: 15,
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [72.8777, 19.076], // Mumbai
              [72.8787, 19.077],
              [72.8797, 19.077],
              [72.8807, 19.076],
              [72.8797, 19.075],
              [72.8787, 19.075],
              [72.8777, 19.076],
            ],
          ],
        ],
      },
      properties: {
        id: "hex3",
        count: 20,
      },
    },
  ],
}

export const getHexFillStyle = (color: string): mapboxgl.FillPaint => ({
  "fill-color": color,
  "fill-opacity": 0.4,
})

export const getBlurredPointStyle = (color: string): mapboxgl.CirclePaint => ({
  "circle-color": color,
  "circle-opacity": [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    MIN_MAP_ZOOM,
    0.05,
    MIN_HEXES_ZOOM + POINTS_AND_HEXES_OVERLAP,
    0.4,
  ],
  "circle-radius": [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    MIN_MAP_ZOOM,
    3,
    MIN_HEXES_ZOOM + POINTS_AND_HEXES_OVERLAP,
    2,
  ],
})

export const getHexOutlineStyle = (
  theme: string | undefined
): mapboxgl.LinePaint => ({
  "line-color": theme === "dark" ? "#fff" : "rgb(113,113,122)",
  "line-width": 4,
})

export const getHexLabelStyle = (
  theme: string | undefined
): mapboxgl.SymbolPaint => ({
  "text-color": theme === "dark" ? "white" : "#6D6D6D",
})

export const hexLabelLayout: mapboxgl.SymbolLayout = {
  "text-font": ["NotoSans-Regular"],
  "text-field": ["get", "count"],
  "text-allow-overlap": false,
  "text-size": 23,
}

export interface HexFeatureDetails {
  hexId: string
  geojson: GeoJSON.Geometry
}

export const ZOOM_BY_HEX_RESOLUTION: { [resolution: number]: number } = {
  10: 14,
  9: 14,
  8: 13,
  7: 12,
  6: 11,
  5: 10,
  4: 9,
}

interface LayerConfig {
  sourcePath: string
  sourceLayer: string
}

export interface NetworkCoverageLayerOption {
  name: string
  icon: (props: any) => JSX.Element
  color: string
  sourceDomain: string
  points: LayerConfig
  hexes: LayerConfig
}

export const networkLayers: { [network: string]: NetworkCoverageLayerOption } =
  {
    mobile: {
      name: "MOBILE",
      icon: HeliumMobileIcon,
      color: HELIUM_MOBILE_COLOR,
      sourceDomain: process.env.NEXT_PUBLIC_HOTSPOTTY_TILESERVER_URL!,
      points: {
        sourcePath: "public.helium_mobile_points.json",
        sourceLayer: "public.helium_mobile_points",
      },
      hexes: {
        sourcePath: "public.helium_mobile_hexes.json",
        sourceLayer: "public.helium_mobile_hexes",
      },
    },
    iot: {
      name: "IOT",
      icon: HeliumIotIcon,
      color: HELIUM_IOT_COLOR,
      sourceDomain: process.env.NEXT_PUBLIC_HELIUMGEEK_TILESERVER_URL!,
      points: {
        sourcePath: "hg.gateways-rewarded-r8.points.json",
        sourceLayer: "hg.gateways-rewarded-r8.points",
      },
      hexes: {
        sourcePath: "hg.gateways-rewarded-r8.hexes.json",
        sourceLayer: "hg.gateways-rewarded-r8.hexes",
      },
    },
    custom: {
      name: "CUSTOM",
      icon: HeliumMobileIcon,
      color: "#266efe",
      sourceDomain: "http://127.0.0.1:3000",
      points: {
        sourcePath: "/radar/points",
        sourceLayer: "custom_points_layer",
      },
      hexes: {
        sourcePath: "/radar/hexes",
        sourceLayer: "custom_hexes_layer",
      },
    },
    customDrone: {
      name: "CUSTOM",
      icon: HeliumMobileIcon,
      color: "#27EE00",
      sourceDomain: "http://127.0.0.1:3000",
      points: {
        sourcePath: "/drone/points",
        sourceLayer: "custom_points_layer",
      },
      hexes: {
        sourcePath: "/drone/hexes",
        sourceLayer: "custom_hexes_layer",
      },
    },
  }
