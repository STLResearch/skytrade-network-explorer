export type DronePoint = {
  id: string
  userId: string
  deviceLocationLat?: number
  deviceLocationLng?: number
  ipAddress: string
  isTest: boolean
  createdAt: string
  remoteData?: {
    name?: string
    model?: string
    status?: string
    battery?: number
    lastUpdate?: string
  }
}

export type PropertyPoint = {
  id: string
  title: string
  address: string
  hasLandingDeck: boolean
  hasChargingStation: boolean
  hasStorageHub: boolean
  isRentableAirspace: boolean
  latitude: number
  longitude: number
  noFlyZone: boolean
  isBoostedArea: boolean
  transitFee: string
  ownerId: string
}

// Base type for points from API
export type PointType = {
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
  // Add additional properties from your API models
  ipAddress?: string
  isTest?: boolean
  createdAt?: string
  remoteData?: any
  // Property specific fields
  hasLandingDeck?: boolean
  hasChargingStation?: boolean
  hasStorageHub?: boolean
  transitFee?: string
  noFlyZone?: boolean
  isBoostedArea?: boolean
  ownerId?: string
}

export type TabType = "drone" | "air_space" | "both"
export type GeoBounds = {
  north: number
  south: number
  east: number
  west: number
}
// Add this to your types.ts file
export type DataType = "drone" | "air_space"
