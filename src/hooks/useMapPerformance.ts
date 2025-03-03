import { useState, useEffect } from "react"

/**
 * Custom hook to monitor and optimize map performance
 */
export function useMapPerformance() {
  const [fps, setFps] = useState<number>(60)
  const [isPerformanceMode, setIsPerformanceMode] = useState<boolean>(false)

  // Track FPS (frames per second) for performance monitoring
  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()

    const measureFps = () => {
      frameCount++
      const now = performance.now()

      // Calculate FPS every second
      if (now - lastTime >= 1000) {
        const measuredFps = Math.round((frameCount * 1000) / (now - lastTime))
        setFps(measuredFps)

        // Auto-enable performance mode if FPS drops below threshold
        if (measuredFps < 20 && !isPerformanceMode) {
          setIsPerformanceMode(true)
        } else if (measuredFps > 40 && isPerformanceMode) {
          setIsPerformanceMode(false)
        }

        frameCount = 0
        lastTime = now
      }

      requestAnimationFrame(measureFps)
    }

    const handle = requestAnimationFrame(measureFps)

    return () => {
      cancelAnimationFrame(handle)
    }
  }, [isPerformanceMode])

  // Get performance recommendations based on current FPS
  const getPerformanceRecommendations = () => {
    if (fps < 15) {
      return {
        shouldReduceDetail: true,
        maxVisiblePoints: 500,
        shouldDisableAnimations: true,
      }
    } else if (fps < 30) {
      return {
        shouldReduceDetail: true,
        maxVisiblePoints: 2000,
        shouldDisableAnimations: false,
      }
    } else {
      return {
        shouldReduceDetail: false,
        maxVisiblePoints: 5000,
        shouldDisableAnimations: false,
      }
    }
  }

  return {
    fps,
    isPerformanceMode,
    setIsPerformanceMode,
    getPerformanceRecommendations,
  }
}
