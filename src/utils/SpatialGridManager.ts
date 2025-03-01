import { MapBounds } from "./MapDataCache"

export interface GridCell {
  bounds: MapBounds
  loaded: boolean
  timestamp: number
}

export class SpatialGridManager {
  private gridCells = new Map<string, GridCell>()

  private getGridKey(lat: number, lng: number, resolution: number): string {
    const latGrid = Math.floor(lat / resolution)
    const lngGrid = Math.floor(lng / resolution)
    return `${latGrid}:${lngGrid}:${resolution}`
  }

  // Get all grid cells that overlap with bounds
  getCellsForBounds(bounds: MapBounds, resolution: number): string[] {
    const minLat = Math.floor(bounds.south / resolution)
    const maxLat = Math.floor(bounds.north / resolution)
    const minLng = Math.floor(bounds.west / resolution)
    const maxLng = Math.floor(bounds.east / resolution)

    const cells: string[] = []

    for (let lat = minLat; lat <= maxLat; lat++) {
      for (let lng = minLng; lng <= maxLng; lng++) {
        cells.push(
          this.getGridKey(lat * resolution, lng * resolution, resolution)
        )
      }
    }

    return cells
  }

  // Mark a cell as loaded
  markCellLoaded(cellKey: string, bounds: MapBounds): void {
    this.gridCells.set(cellKey, {
      bounds,
      loaded: true,
      timestamp: Date.now(),
    })
  }

  // Check if a cell is already loaded
  isCellLoaded(cellKey: string): boolean {
    return this.gridCells.has(cellKey) && this.gridCells.get(cellKey)!.loaded
  }

  // Get cells that need to be loaded for bounds
  getCellsToLoad(bounds: MapBounds, resolution: number): string[] {
    const cells = this.getCellsForBounds(bounds, resolution)
    return cells.filter((cell) => !this.isCellLoaded(cell))
  }

  // Get bounds for a cell
  getBoundsForCell(cellKey: string): MapBounds {
    if (this.gridCells.has(cellKey)) {
      return this.gridCells.get(cellKey)!.bounds
    }

    const [latStr, lngStr, resStr] = cellKey.split(":")
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    const resolution = parseFloat(resStr)

    return {
      north: lat + resolution,
      south: lat,
      east: lng + resolution,
      west: lng,
    }
  }

  // Clear old cells to prevent memory leaks
  clearOldCells(maxAge: number = 30 * 60 * 1000): void {
    const now = Date.now()

    for (const [key, cell] of this.gridCells.entries()) {
      if (now - cell.timestamp > maxAge) {
        this.gridCells.delete(key)
      }
    }
  }
}
