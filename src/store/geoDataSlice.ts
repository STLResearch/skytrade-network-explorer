import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PointType } from "@/types"

export type CachedArea = {
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
  zoomLevel: number
  timestamp: number
}

interface GeoDataState {
  // Normalized data for fast lookup
  droneData: Record<string, PointType>
  airSpaceData: Record<string, PointType>
  cachedAreas: CachedArea[]
}

const initialState: GeoDataState = {
  droneData: {},
  airSpaceData: {},
  cachedAreas: [],
}

const geoDataSlice = createSlice({
  name: "geoData",
  initialState,
  reducers: {
    addDronePoints(state, action: PayloadAction<PointType[]>) {
      action.payload.forEach((point) => {
        state.droneData[point.id] = point
      })
    },
    addAirSpacePoints(state, action: PayloadAction<PointType[]>) {
      action.payload.forEach((point) => {
        state.airSpaceData[point.id] = point
      })
    },
    addCachedArea(state, action: PayloadAction<CachedArea>) {
      state.cachedAreas.push(action.payload)
      // Limit cached areas to avoid memory bloat
      if (state.cachedAreas.length > 100) {
        state.cachedAreas = state.cachedAreas.slice(-100)
      }
    },
    clearCache(state) {
      state.droneData = {}
      state.airSpaceData = {}
      state.cachedAreas = []
    },
  },
})

export const { addDronePoints, addAirSpacePoints, addCachedArea, clearCache } =
  geoDataSlice.actions
export default geoDataSlice.reducer
