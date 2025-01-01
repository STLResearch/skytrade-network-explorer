## Instructions for api

### Expected Data Format for `Source` Component

The `Source` component expects data in the form of a GeoJSON `FeatureCollection`. This is a widely-used format for representing geographical features and their attributes.

#### Structure of GeoJSON `FeatureCollection`

- **type**: This should always be `"FeatureCollection"`.
- **features**: An array of `Feature` objects. Each `Feature` object should have:
  - **type**: `"Feature"`
  - **geometry**: An object representing the geometry of the feature. It should have:
    - **type**: The type of geometry (e.g., `"Point"`, `"LineString"`, `"Polygon"`).
    - **coordinates**: An array defining the coordinates of the geometry.
  - **properties**: An object containing key-value pairs of additional data related to the feature.

#### Example

#### Sample data for points.json

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [125.6, 10.1]
      },
      "properties": {
        "id": "point1",
        "name": "this is point1"
      }
    }
    // More features...
    // more lat long points
  ]
}
```

Ensure that the data provided adheres to this structure so that it can be correctly processed by the `Source` component.

#### Endpoint for JSON Data

The `Source` component requires a JSON file with the GeoJSON `FeatureCollection` structure. Please provide an endpoint that returns this data in the JSON format.

#### Converting Data to Hexagonal Format

The `Source` component also requires the data to represent data in the form of hexagons. We can use the `h3-js` library to convert the latitude-longitude coordinates to hexagons.

We can use the `h3-js` library like this:

```javascript
const fs = require("fs")
const { latLngToCell, cellToBoundary, cellsToMultiPolygon } = require("h3-js")

// Read points from points.json
const points = JSON.parse(fs.readFileSync("points.json", "utf8"))

// Convert points to hexagons and get boundaries
const resolution = 5 // Example resolution (0-15)
const hexFeatures = points.features.map((point) => {
  const [longitude, latitude] = point.geometry.coordinates
  const hexagonIndex = latLngToCell(latitude, longitude, resolution)
  const hexagonBoundary = cellsToMultiPolygon([hexagonIndex], true)
  console.log(cellsToMultiPolygon([hexagonIndex], true))
  return {
    type: "Feature",
    geometry: {
      type: "MultiPolygon",
      coordinates: hexagonBoundary,
    },
    properties: {
      ...point.properties,
    },
  }
})

// Create GeoJSON structure
const hexGeoJSON = {
  type: "FeatureCollection",
  features: hexFeatures,
}

// Save hexagons to hexes.json
fs.writeFileSync("hexes.json", JSON.stringify(hexGeoJSON, null, 2), "utf8")

console.log("Hexagons have been saved to hexes.json")
```

### Expected Data Format for Hexagon representation

`HexagonLayer` expects the data to be in the form of a GeoJSON `FeatureCollection` where each `Feature` object represents a hexagon.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
          [
            [
              [77.4126, 23.2599],
              [77.4136, 23.2609],
              [77.4146, 23.2609],
              [77.4156, 23.2599],
              [77.4146, 23.2589],
              [77.4136, 23.2589],
              [77.4126, 23.2599]
            ]
          ]
        ]
      },
      "properties": {
        "id": "hex1",
        "name": "this is hexagon1"
      }
    }

    //<!-- More hexagons -->
  ]
}
```

Ensure that the data provided adheres to this structure so that it can be correctly processed by the component.
`

Now we need two endpoints one which returns points.json and other which returns hexes.json

1. https://api.com/drone/points <br>
   `return points.json` file
2. https://api.com/drone/hexes <br>
   `return hexes.json` file

Similarly for radar data

1. https://api.com/radar/points <br>
   `return points.json` file
2. https://api.com/radar/hexes <br>
   `return hexes.json` file
