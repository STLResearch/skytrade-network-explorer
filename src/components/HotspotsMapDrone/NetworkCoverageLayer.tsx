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
  sampleHexesData,
} from "./utils"

export function NetworkCoverageLayer({
  layer: { color },
  ...props
}: {
  layer: NetworkCoverageLayerOption
}) {
  const { resolvedTheme } = useTheme()
  return (
    <Fragment {...props}>
      <Source id="points_source" type="geojson" data={samplePointsData}>
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
      <Source id="hexes_source" type="geojson" data={sampleHexesData}>
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
