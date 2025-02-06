"use client"

// import { usePreferences } from "@/context/usePreferences"
import Link from "next/link"
import { gaEvent } from "../GATracker"
import { HeliumIotIcon } from "../icons/HeliumIotIcon"
import { HeliumMobileIcon } from "../icons/HeliumMobileIcon"
import { Hotspot } from "./HexHotspots"

type HexHotSpotItemProps = {
  hotspot: Hotspot
}

export const HexHotSpotItem = ({ hotspot }: HexHotSpotItemProps) => {
  // const { provider } = usePreferences()
  const { cbrs, wifi, mobile } = hotspot.capabilities
  const isMobile = cbrs || wifi || mobile
  const Avatar = isMobile ? HeliumMobileIcon : HeliumIotIcon
  // const subtitle = isMobile ? `Mobile Hotspot` : "IoT Hotspot"
  const subtitle = "Air Space"

  return (
    <li key={hotspot.address}>
      <div className="group relative flex items-center px-2 py-3">
        <div>
          <div
            className="absolute inset-0 group-hover:bg-zinc-300/30 dark:group-hover:bg-zinc-700/30"
            aria-hidden="true"
          />
          <div className="relative flex min-w-0 flex-1 items-center gap-4">
            <Avatar className="inline-block h-8 w-8 flex-shrink-0" />
            <div className="truncate">
              <p className="truncate text-sm font-medium leading-5 text-gray-900 dark:text-zinc-100">
                {hotspot.title}
              </p>
              <p className="truncate text-xs text-gray-600 dark:text-zinc-300">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
