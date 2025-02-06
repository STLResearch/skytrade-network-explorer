interface Layer {
  id: number
  createdAt: string
  updateAt: string
  tokenId: string
  propertyId: number
  isCurrentlyInAuction: boolean
}

interface PropertyStatus {
  id: number
  type: string
}

interface Vertex {
  id: number
  createdAt: string
  updateAt: string
  latitude: number
  longitude: number
  propertyId: number
  isSoftDelete: boolean
}

interface WeekDayRange {
  createdAt: string
  updateAt: string
  fromTime: number
  toTime: number
  isAvailable: boolean
  weekDayId: number
  propertyId: number
}

interface Point {
  id: number
  createdAt: string
  updateAt: string
  title: string
  transitFee: string
  address: string
  timezone: string
  fullTimezone: string | null
  hasLandingDeck: boolean
  hasChargingStation: boolean
  hasStorageHub: boolean
  isFixedTransitFee: boolean
  isRentableAirspace: boolean
  ownerId: number
  noFlyZone: boolean
  isBoostedArea: boolean
  latitude: number
  longitude: number
  propertyStatusId: number
  isActive: boolean
  isPropertyRewardClaimed: boolean
  isSoftDelete: boolean
  hasZoningPermission: boolean
  orderPhotoforGeneratedMap: boolean
  assessorParcelNumber: string
  externalBlockchainAddress: string | null
  areaPolygon: string
  tokenValue: string | null
  layers: Layer[]
  propertyStatus: PropertyStatus
  vertexes: Vertex[]
  weekDayRanges: WeekDayRange[]
  images: string[]
  price: number
}

export default Point
