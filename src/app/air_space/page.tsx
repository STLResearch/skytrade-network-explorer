import { HexGridMap } from "@/components/OptimisedHexGridMap"
import { HotspotsMap } from "@/components/HotspotsMap"
import { MapExplorer } from "@/components/MapExplorer"

export default async function Page() {
  return <HexGridMap tab="air_space" />
}
