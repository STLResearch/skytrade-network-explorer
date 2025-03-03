import { createSelector } from "@reduxjs/toolkit"
import { RootState } from "@/store/store"

// If droneData is an object of { [id]: PointType },
export const selectDronePoints = createSelector(
  (state: RootState) => state.geoData.droneData,
  (droneData) => Object.values(droneData) // only recalculates when droneData reference changes
)

export const selectAirSpacePoints = createSelector(
  (state: RootState) => state.geoData.airSpaceData,
  (airSpaceData) => Object.values(airSpaceData)
)
