import { NextResponse } from "next/server"

interface Point {
  id: number
  title: string
  latitude: number
  longitude: number
  price?: number
  isRentableAirspace?: boolean
}

/**
 * Utility to generate random points within a bounding box.
 */
function generateRandomPointsWithinBounds(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  count = 50
): Point[] {
  const points: Point[] = []
  for (let i = 0; i < count; i++) {
    const latitude = Math.random() * (maxLat - minLat) + minLat
    const longitude = Math.random() * (maxLon - minLon) + minLon
    points.push({
      id: i,
      title: `DroneRadar Point #${i}`,
      latitude,
      longitude,
      price: Math.round(Math.random() * 10000) / 100, // random price
      isRentableAirspace: Math.random() < 0.5, // random boolean
    })
  }
  return points
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const maxLatitude = parseFloat(searchParams.get("maxLatitude") || "90")
    const minLatitude = parseFloat(searchParams.get("minLatitude") || "-90")
    const maxLongitude = parseFloat(searchParams.get("maxLongitude") || "180")
    const minLongitude = parseFloat(searchParams.get("minLongitude") || "-180")

    // Generate some random points in the bounding box
    const fakeData = generateRandomPointsWithinBounds(
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
      30 // number of random points to generate
    )

    return NextResponse.json(fakeData, { status: 200 })
  } catch (error) {
    console.error("Error in droneRadar route:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
