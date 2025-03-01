import { Feature } from "geojson"

interface CacheItem {
  id: string
  features: Feature[]
  timestamp: number
  dataType: string // 'drone' or 'property'
}

/**
 * A service for caching geospatial data in IndexedDB
 */
export class IndexedDBCache {
  private dbName: string
  private storeName: string
  private version: number
  private db: IDBDatabase | null = null
  private initPromise: Promise<boolean> | null = null

  constructor(dbName = "mapDataCache", storeName = "spatialData", version = 1) {
    this.dbName = dbName
    this.storeName = storeName
    this.version = version
  }

  /**
   * Initialize the database
   */
  public async init(): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise
    }

    if (!window.indexedDB) {
      console.error("IndexedDB is not supported in this browser")
      return false
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.dbName, this.version)

      request.onerror = (event) => {
        console.error("Error opening IndexedDB:", event)
        reject(false)
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve(true)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create an object store for spatial data with cell ID as key
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" })

          // Create indexes for more efficient queries
          store.createIndex("timestamp", "timestamp", { unique: false })
          store.createIndex("dataType", "dataType", { unique: false })
        }
      }
    })

    return this.initPromise
  }

  /**
   * Store features in the cache
   */
  public async setItem(
    cellId: string,
    features: Feature[],
    dataType: string
  ): Promise<boolean> {
    try {
      await this.init()

      if (!this.db) {
        return false
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)

        const item: CacheItem = {
          id: `${dataType}_${cellId}`,
          features,
          timestamp: Date.now(),
          dataType,
        }

        const request = store.put(item)

        request.onsuccess = () => resolve(true)
        request.onerror = (event) => {
          console.error("Error storing data in IndexedDB:", event)
          reject(false)
        }
      })
    } catch (error) {
      console.error("Error in setItem:", error)
      return false
    }
  }

  /**
   * Retrieve features from the cache
   */
  public async getItem(
    cellId: string,
    dataType: string
  ): Promise<{ features: Feature[]; timestamp: number } | null> {
    try {
      await this.init()

      if (!this.db) {
        return null
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readonly")
        const store = transaction.objectStore(this.storeName)
        const request = store.get(`${dataType}_${cellId}`)

        request.onsuccess = () => {
          const result = request.result as CacheItem | undefined
          if (result) {
            resolve({
              features: result.features,
              timestamp: result.timestamp,
            })
          } else {
            resolve(null)
          }
        }

        request.onerror = (event) => {
          console.error("Error retrieving data from IndexedDB:", event)
          reject(null)
        }
      })
    } catch (error) {
      console.error("Error in getItem:", error)
      return null
    }
  }

  /**
   * Clear items older than the provided timestamp
   */
  public async clearOldItems(maxAge: number): Promise<number> {
    try {
      await this.init()

      if (!this.db) {
        return 0
      }

      const cutoffTime = Date.now() - maxAge

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)
        const index = store.index("timestamp")

        // IDBKeyRange.upperBound includes the boundary value
        const range = IDBKeyRange.upperBound(cutoffTime)
        const request = index.openCursor(range)

        let deleteCount = 0

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue | null

          if (cursor) {
            store.delete(cursor.value.id)
            deleteCount++
            cursor.continue()
          } else {
            resolve(deleteCount)
          }
        }

        request.onerror = (event) => {
          console.error("Error clearing old items from IndexedDB:", event)
          reject(0)
        }
      })
    } catch (error) {
      console.error("Error in clearOldItems:", error)
      return 0
    }
  }

  /**
   * Get all items of a specific data type
   */
  public async getAllItemsByType(
    dataType: string
  ): Promise<{ [cellId: string]: Feature[] }> {
    try {
      await this.init()

      if (!this.db) {
        return {}
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readonly")
        const store = transaction.objectStore(this.storeName)
        const index = store.index("dataType")
        const request = index.openCursor(IDBKeyRange.only(dataType))

        const result: { [cellId: string]: Feature[] } = {}

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue | null

          if (cursor) {
            const item = cursor.value as CacheItem
            // Extract the cellId from the composite key (dataType_cellId)
            const cellId = item.id.substring(dataType.length + 1)
            result[cellId] = item.features
            cursor.continue()
          } else {
            resolve(result)
          }
        }

        request.onerror = (event) => {
          console.error("Error retrieving items by type from IndexedDB:", event)
          reject({})
        }
      })
    } catch (error) {
      console.error("Error in getAllItemsByType:", error)
      return {}
    }
  }

  /**
   * Get the total size of the cache (number of entries)
   */
  public async getSize(): Promise<number> {
    try {
      await this.init()

      if (!this.db) {
        return 0
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readonly")
        const store = transaction.objectStore(this.storeName)
        const countRequest = store.count()

        countRequest.onsuccess = () => {
          resolve(countRequest.result)
        }

        countRequest.onerror = (event) => {
          console.error("Error counting items in IndexedDB:", event)
          reject(0)
        }
      })
    } catch (error) {
      console.error("Error in getSize:", error)
      return 0
    }
  }

  /**
   * Clear all cache data
   */
  public async clearAll(): Promise<boolean> {
    try {
      await this.init()

      if (!this.db) {
        return false
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], "readwrite")
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()

        request.onsuccess = () => {
          resolve(true)
        }

        request.onerror = (event) => {
          console.error("Error clearing IndexedDB:", event)
          reject(false)
        }
      })
    } catch (error) {
      console.error("Error in clearAll:", error)
      return false
    }
  }
}

// Create a singleton instance
export const mapCache = new IndexedDBCache()
