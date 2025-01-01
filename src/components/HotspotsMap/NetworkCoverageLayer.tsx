import { useTheme } from "next-themes"
import { Fragment } from "react"
import { Layer, Source } from "react-map-gl"
import img from "public/images/cat.png"
import {
  MIN_HEXES_ZOOM,
  MIN_HEX_LABELS_ZOOM,
  NetworkCoverageLayerOption,
  POINTS_AND_HEXES_OVERLAP,
  getBlurredPointStyle,
  getHexFillStyle,
  getHexLabelStyle,
  hexLabelLayout,
  samplePointsData,
  // sampleHexesData,
} from "./utils"
const sampleHexesData: FeatureCollection = {
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

import hexesData from "../../../hexes.json" assert { type: "json" }
import pointsData from "../../../points.json" assert { type: "json" }
import { FeatureCollection } from "geojson"

function validateFeatureCollection(data: any): FeatureCollection {
  if (data.type !== "FeatureCollection") {
    throw new Error('Invalid GeoJSON: type must be "FeatureCollection"')
  }
  return data as FeatureCollection
}
const hexesDataTyped = validateFeatureCollection(hexesData)
const pointsDataTyped = validateFeatureCollection(pointsData)

export function NetworkCoverageLayer({
  layer: { color, sourceDomain, points, hexes },
  ...props
}: {
  layer: NetworkCoverageLayerOption
}) {
  const { resolvedTheme } = useTheme()
  return (
    <Fragment {...props}>
      <Source id="points_source" type="geojson" data={pointsDataTyped}>
        <Layer
          id="points_layer"
          type="circle"
          // source-layer="custom_points_layer"
          maxzoom={MIN_HEXES_ZOOM + POINTS_AND_HEXES_OVERLAP}
          paint={getBlurredPointStyle(color)}
        />
        {/* <Layer
          id="hotspot_count_labels"
          type="symbol"
          source-layer="custom_points_layer"
          minzoom={MIN_HEX_LABELS_ZOOM}
          layout={hexLabelLayout}
          paint={getHexLabelStyle(resolvedTheme)}
        /> */}
      </Source>
      <Source id="hexes_source" type="geojson" data={hexesDataTyped}>
        <Layer
          id="hexes_layer"
          type="fill"
          // source-layer="custom_hexes_layer"
          paint={getHexFillStyle(color)}
          minzoom={MIN_HEXES_ZOOM}
        />
      </Source>
    </Fragment>
  )
}
