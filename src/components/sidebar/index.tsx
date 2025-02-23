import { HexHotspots } from "@/components/HotspotsMap/HexHotspots"
import { LoadingHexHotspots } from "@/components/HotspotsMap/LoadingHexHotspots"
import { XMarkIcon } from "@heroicons/react/24/outline"
import clsx from "clsx"

function formatHexId(hexId: string): string {
  if (hexId.length <= 6) {
    return hexId
  }
  const start = hexId.slice(0, 3)
  const end = hexId.slice(-3)
  return `${start}...${end}`
}

export default function Page({
  hexId,
  propertyName,
  price,
  onClose,
}: {
  hexId: string
  propertyName: string
  price?: number
  onClose: () => void
}) {
  return (
    <div
      className={clsx(
        "absolute bottom-28 left-4 right-4 top-6 z-40 flex w-auto flex-col gap-4 rounded-xl px-4 py-2 text-sm font-medium shadow-lg shadow-zinc-800/5 ring-1 backdrop-blur-sm sm:bottom-6 sm:left-6 sm:right-auto sm:top-24 sm:max-h-[calc(100vh-8rem)] sm:w-80",
        "bg-white/30 text-zinc-800 ring-zinc-900/5",
        "dark:bg-zinc-800/30 dark:text-zinc-200 dark:ring-white/10",
        "mt-16"
      )}
    >
      <div className="flex w-full items-center gap-3 p-2">
        <div className="flex-1 text-xl text-zinc-300 dark:text-zinc-100">
          {formatHexId(hexId)}
        </div>
        <button onClick={onClose}>
          <XMarkIcon className="h-6 w-6 text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-400 hover:dark:text-zinc-100" />
        </button>
      </div>
      <HexHotspots hexId={hexId} propertyName={propertyName} price={price} />
    </div>
  )
}
