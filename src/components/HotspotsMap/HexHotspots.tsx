"use client"

import clsx from "clsx"
import { HexHotSpotItem } from "./HexHotspotItem"

export type Hotspot = {
  address: string
  title: string
  status: number
  statusString: "active" | "inactive"
  capabilities: {
    mobile: boolean
    iot: boolean
    cbrs: boolean
    wifi: boolean
  }
  location: {
    hex: string
  }
}

const RECENT = "recently rewarded"
const NOT_RECENT = "not recently rewarded"

const TOOLTIP_DESCRIPTIONS = {
  [RECENT]: "A hotspot that has received rewards in the past 30 days.",
  [NOT_RECENT]:
    "A hotspot that has not received rewards in the past 30 days. Such a hotstop is most likely offline. It is also possible for it to be online but not rewarded if it is not transmitting data, not participating in PoC, or only recently online.",
}

function getGroupedHotspots(hotspots: Hotspot[]) {
  const groupedHotspots: {
    [RECENT]: Hotspot[]
    [NOT_RECENT]: Hotspot[]
  } = {
    [RECENT]: [],
    [NOT_RECENT]: [],
  }

  hotspots.forEach((hotspot) => {
    const group = hotspot.status === 0 ? RECENT : NOT_RECENT
    groupedHotspots[group].push(hotspot)
  })

  return groupedHotspots
}

export function HexHotspots({
  hexId,
  propertyName,
  price,
}: {
  hexId: string
  propertyName: string
  price?: number
}) {
  setTimeout(() => {}, 3000)

  const hotspots: Hotspot[] = [
    {
      address: "112tAUfmQ5orU7A1mVWQ3PPQXwwi5GEReMkKgMo5LKXxHgqpoAdt",
      title: "Air space",
      status: 0,
      statusString: "active",
      capabilities: {
        mobile: false,
        iot: true,
        cbrs: false,
        wifi: false,
      },
      location: {
        // hex: '8c3dac39da5c5ff',
        hex: hexId,
      },
    },
  ]

  const groupedList = getGroupedHotspots(hotspots)

  if (hotspots.length === 0) {
    return (
      <div className="mb-2 text-sm font-medium text-gray-900 dark:text-zinc-200">
        This hex contains no Hotspots.
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-y-auto">
      {(Object.keys(groupedList) as Array<keyof typeof groupedList>).map(
        (group) => {
          if (groupedList[group].length === 0) return
          return (
            <div key={group}>
              <div
                className={clsx(
                  "sticky top-0 z-10 flex items-center justify-between rounded-lg px-2.5 py-1 text-sm font-medium",
                  "bg-zinc-300/80 text-gray-700",
                  "dark:bg-zinc-500/50 dark:text-white"
                )}
              >
                <div className="flex gap-2">
                  <div className="font-bold">{propertyName}</div>
                </div>
                <span className="ml-2 text-xs font-normal">
                  {price != null && (
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Price: ${price}
                    </div>
                  )}
                </span>
              </div>
            </div>
          )
        }
      )}
    </div>
  )
}
