const fs = require("fs")

function generateSampleDataWithHexes(numPoints = 200, hexRadius = 0.1) {
  const pointsFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  }

  const hexesFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  }

  for (let i = 0; i < numPoints; i++) {
    // Generate random point coordinates (longitude and latitude)
    const lon = Math.random() * 360 - 180 // Longitude: -180 to 180
    const lat = Math.random() * 180 - 90 // Latitude: -90 to 90

    // Add Point geometry
    pointsFeatureCollection.features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lon, lat],
      },
      properties: {
        id: `point${i + 1}`,
        name: `Sample Point ${i + 1}`,
      },
    })

    // Add Hexagon geometry for the same point
    hexesFeatureCollection.features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: generateHexagonCoordinates([lon, lat], hexRadius),
      },
      properties: {
        id: `hex${i + 1}`,
        name: `Sample Hexagon ${i + 1}`,
      },
    })
  }

  return { pointsFeatureCollection, hexesFeatureCollection }
}

// Helper function to generate hexagon coordinates
function generateHexagonCoordinates(center, radius) {
  const [cx, cy] = center
  const coordinates = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i // 60-degree intervals
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    coordinates.push([x, y])
  }
  // Close the polygon by repeating the first coordinate
  coordinates.push(coordinates[0])
  return [coordinates]
}

// Generate data
const { pointsFeatureCollection, hexesFeatureCollection } =
  generateSampleDataWithHexes(5000, 0.1)

// Write data to files
fs.writeFileSync(
  "points.json",
  JSON.stringify(pointsFeatureCollection, null, 2)
)
fs.writeFileSync("hexes.json", JSON.stringify(hexesFeatureCollection, null, 2))

console.log("GeoJSON files have been created: points.geojson and hexes.geojson")
