import { XMarkIcon } from "@heroicons/react/24/outline"
import clsx from "clsx"
import { useState, useEffect } from "react"

function formatHexId(hexId: string): string {
  if (hexId.length <= 6) {
    return hexId
  }
  const start = hexId.slice(0, 3)
  const end = hexId.slice(-3)
  return `${start}...${end}`
}

// Define our data types based on API models
type DronePoint = {
  id: string
  userId: string
  deviceLocationLat?: number
  deviceLocationLng?: number
  ipAddress: string
  isTest: boolean
  createdAt: string
  // We can include specific fields from remoteData if needed
  remoteData?: {
    name?: string
    model?: string
    status?: string
    battery?: number
    lastUpdate?: string
  }
}

type PropertyPoint = {
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
  // Calculated fields
  amenities?: string[]
  statusDisplay?: string
}

export default function Sidebar({
  hexId,
  pointData,
  pointCount,
  pointType,
  onClose,
}: {
  hexId: string
  pointData?: DronePoint[] | PropertyPoint[]
  pointCount: number
  pointType: "drone" | "air_space"
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [pointData])

  // Determine if we have a single point or multiple
  const isSinglePoint = pointCount === 1

  // Get the current selected point data
  const selectedPoint = isSinglePoint && pointData ? pointData[0] : null

  // Colors based on point type
  const typeColors = {
    drone: {
      primary: "#3B82F6", // Blue
      secondary: "#93C5FD", // Light blue
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      icon: "bg-blue-500",
    },
    air_space: {
      primary: "#F97316", // Orange
      secondary: "#FDBA74", // Light orange
      badge:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      icon: "bg-orange-500",
    },
  }

  const currentTheme = typeColors[pointType]

  return (
    <div
      className={clsx(
        "absolute bottom-28 left-4 right-4 top-6 z-40 flex w-auto flex-col gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-lg shadow-zinc-800/5 ring-1 backdrop-blur-sm sm:bottom-6 sm:left-6 sm:right-auto sm:top-24 sm:max-h-[calc(100vh-8rem)] sm:w-96",
        "bg-zinc-900/90 text-zinc-100 ring-zinc-700/50",
        "dark:bg-zinc-900/90 dark:text-zinc-100 dark:ring-white/10",
        "mt-16"
      )}
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between border-b border-zinc-700/50 p-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: currentTheme.icon }}
          />
          <div className="text-xl font-semibold text-zinc-100">
            {pointType === "drone" ? "Drone Concentration" : "Air Space"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 transition-colors hover:bg-zinc-800"
        >
          <XMarkIcon className="h-6 w-6 text-zinc-400 hover:text-zinc-100" />
        </button>
      </div>

      {/* Hex ID and Count Info */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="text-sm text-zinc-400">
          Hex:{" "}
          <span className="font-mono text-zinc-300">{formatHexId(hexId)}</span>
        </div>
        <div className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-300">{pointCount}</span>{" "}
          {pointCount === 1 ? "point" : "points"}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{
              borderColor: `${currentTheme.secondary} transparent transparent transparent`,
            }}
          ></div>
        </div>
      )}

      {/* Content for Multiple Points */}
      {!loading && !isSinglePoint && pointData && pointData.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {/* Tabs for multiple points */}
          <div className="mb-2 flex space-x-1 border-b border-zinc-700/50">
            {pointData.slice(0, 5).map((point, index) => (
              <button
                key={index}
                className={clsx(
                  "rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === index
                    ? `border-b-2 bg-opacity-20 text-zinc-100`
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                )}
                style={{
                  backgroundColor:
                    activeTab === index ? `${currentTheme.primary}20` : "",
                  borderBottomColor:
                    activeTab === index ? currentTheme.primary : "transparent",
                }}
                onClick={() => setActiveTab(index)}
              >
                {index + 1}
              </button>
            ))}
            {pointData.length > 5 && (
              <div className="px-3 py-1.5 text-sm text-zinc-500">
                +{pointData.length - 5} more
              </div>
            )}
          </div>

          {/* Details for selected point */}
          {pointData.length > activeTab &&
            renderPointDetails(pointData[activeTab], pointType, currentTheme)}
        </div>
      )}

      {/* Content for Single Point */}
      {!loading && isSinglePoint && selectedPoint && (
        <div className="flex-1 overflow-y-auto">
          {renderPointDetails(selectedPoint, pointType, currentTheme)}
        </div>
      )}

      {/* No Points State */}
      {!loading && (!pointData || pointData.length === 0) && (
        <div className="flex flex-1 items-center justify-center text-zinc-400">
          No details available for this selection.
        </div>
      )}
    </div>
  )
}

// Helper function to render details based on point type
function renderPointDetails(
  point: any,
  pointType: "drone" | "air_space",
  theme: any
) {
  if (pointType === "drone") {
    return <DroneDetails point={point as DronePoint} theme={theme} />
  } else {
    return <PropertyDetails point={point as PropertyPoint} theme={theme} />
  }
}

// Component for drone details
function DroneDetails({ point, theme }: { point: DronePoint; theme: any }) {
  // Format date for better display
  const formattedDate = new Date(point.createdAt).toLocaleString()
  const lastUpdate = point.remoteData?.lastUpdate
    ? new Date(point.remoteData.lastUpdate).toLocaleString()
    : "Unknown"

  return (
    <div className="space-y-4 p-2">
      {/* Essential Info */}
      <div>
        <h3 className="text-base font-semibold text-zinc-100">
          {point.remoteData?.name || `Drone ${point.id.substring(0, 8)}`}
        </h3>
        <p className="text-sm text-zinc-400">
          ID: <span className="text-zinc-300">{point.id}</span>
        </p>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <DetailItem
          label="Status"
          value={
            point.remoteData?.status ||
            (point.isTest ? "Test Device" : "Active")
          }
          valueColor={point.isTest ? "text-yellow-400" : "text-green-400"}
        />
        <DetailItem
          label="Model"
          value={point.remoteData?.model || "Unknown"}
        />
        <DetailItem label="Last Update" value={lastUpdate} />
        {point.remoteData?.battery !== undefined && (
          <DetailItem
            label="Battery"
            value={`${point.remoteData.battery}%`}
            valueColor={getBatteryColor(point.remoteData.battery)}
          />
        )}
        <DetailItem label="Created" value={formattedDate} />
      </div>

      {/* Location Details */}
      <div>
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Location</h4>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/70 p-2 font-mono text-xs">
          <div>
            Lat:{" "}
            <span className="text-zinc-300">
              {point.deviceLocationLat?.toFixed(6) || "N/A"}
            </span>
          </div>
          <div>
            Lng:{" "}
            <span className="text-zinc-300">
              {point.deviceLocationLng?.toFixed(6) || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Component for property details
function PropertyDetails({
  point,
  theme,
}: {
  point: PropertyPoint
  theme: any
}) {
  // Create amenities array
  const amenities = [
    point.hasLandingDeck && "Landing Deck",
    point.hasChargingStation && "Charging Station",
    point.hasStorageHub && "Storage Hub",
    point.isRentableAirspace && "Rentable Airspace",
    point.isBoostedArea && "Boosted Area",
  ].filter(Boolean) as string[]

  // Determine status display
  const getStatusDisplay = () => {
    if (point.noFlyZone) return "No-Fly Zone"
    return "Available"
  }

  return (
    <div className="space-y-4 p-2">
      {/* Essential Info */}
      <div>
        <h3 className="text-base font-semibold text-zinc-100">{point.title}</h3>
        <p className="text-sm text-zinc-400">{point.address}</p>
      </div>

      {/* Status and Price */}
      <div className="flex items-center justify-between">
        <DetailItem
          label="Status"
          value={getStatusDisplay()}
          valueColor={point.noFlyZone ? "text-red-400" : "text-green-400"}
        />
        <DetailItem
          label="Transit Fee"
          value={point.transitFee}
          valueColor="text-zinc-300"
        />
      </div>

      {/* Amenities */}
      <div>
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Amenities</h4>
        {amenities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {amenities.map((amenity, index) => (
              <span
                key={index}
                className={`rounded-full px-2 py-1 text-xs ${theme.badge}`}
              >
                {amenity}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No amenities listed</p>
        )}
      </div>

      {/* Location Details */}
      <div>
        <h4 className="mb-1 text-sm font-semibold text-zinc-300">Location</h4>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/70 p-2 font-mono text-xs">
          <div>
            Lat:{" "}
            <span className="text-zinc-300">{point.latitude.toFixed(6)}</span>
          </div>
          <div>
            Lng:{" "}
            <span className="text-zinc-300">{point.longitude.toFixed(6)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper component for a detail item
function DetailItem({
  label,
  value,
  valueColor = "text-zinc-300",
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-zinc-500">{label}:</span>
      <span className={`text-sm font-medium ${valueColor}`}>{value}</span>
    </div>
  )
}

// Helper function to determine battery color
function getBatteryColor(batteryPercentage: number): string {
  if (batteryPercentage >= 70) return "text-green-400"
  if (batteryPercentage >= 30) return "text-yellow-400"
  return "text-red-400"
}
