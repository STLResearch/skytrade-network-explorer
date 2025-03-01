export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export class MapDataCache {
  private db: IDBDatabase | null = null
  private readonly DB_NAME = "skyTradeMapCache"
  private readonly STORE_NAME = "mapData"

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: "id" })
          store.createIndex("timestamp", "timestamp", { unique: false })
          store.createIndex("type", "type", { unique: false })
          store.createIndex("bounds", "bounds", { unique: false })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error)
      }
    })
  }

  // Store map data with bounds info
  async storeData(
    type: "drone" | "air_space",
    bounds: MapBounds,
    data: any[]
  ): Promise<void> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite")
      const store = transaction.objectStore(this.STORE_NAME)

      const id = `${type}-${bounds.north.toFixed(2)}-${bounds.south.toFixed(
        2
      )}-${bounds.east.toFixed(2)}-${bounds.west.toFixed(2)}`
      const record = {
        id,
        type,
        bounds,
        data,
        timestamp: Date.now(),
      }

      const request = store.put(record)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Retrieve cached data that intersects with given bounds
  async getData(
    type: "drone" | "air_space",
    bounds: MapBounds
  ): Promise<any[]> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly")
      const store = transaction.objectStore(this.STORE_NAME)
      const index = store.index("type")

      const request = index.getAll(IDBKeyRange.only(type))

      request.onsuccess = () => {
        const records = request.result
        const matchingRecords = records.filter((record) => {
          // Check if record bounds overlap with requested bounds
          return !(
            record.bounds.north < bounds.south ||
            record.bounds.south > bounds.north ||
            record.bounds.east < bounds.west ||
            record.bounds.west > bounds.east
          )
        })

        // Extract and deduplicate data
        const allData = matchingRecords.flatMap((record) => record.data)
        const uniqueData = [
          ...new Map(allData.map((item) => [item.id, item])).values(),
        ]

        resolve(uniqueData)
      }

      request.onerror = () => reject(request.error)
    })
  }

  // Clear old cache entries
  async cleanupCache(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite")
      const store = transaction.objectStore(this.STORE_NAME)
      const index = store.index("timestamp")

      const cutoffTime = Date.now() - maxAge
      const range = IDBKeyRange.upperBound(cutoffTime)

      const request = index.openCursor(range)

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }
}
