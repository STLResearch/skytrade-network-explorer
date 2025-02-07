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
  data: { hexesData, pointsData },
  ...props
}: {
  layer: NetworkCoverageLayerOption
  data: {
    hexesData: FeatureCollection | undefined
    pointsData: FeatureCollection | undefined
  }
}) {
  const { resolvedTheme } = useTheme()
  return (
    <Fragment {...props}>
      <Source id="points_source" type="geojson" data={pointsData}>
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
      <Source id="hexes_source" type="geojson" data={hexesData}>
        <Layer
          id="hexes_layer"
          type="fill"
          // source-layer="custom_hexes_layer"
          paint={getHexFillStyle(color)}
          // minzoom={MIN_HEXES_ZOOM}
        />
      </Source>
    </Fragment>
  )
}
