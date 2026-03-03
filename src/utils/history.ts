export type EpisodeData = {
  label: string
  url: string
  index: number
}

export type WatchHistoryItem = {
  id: string
  vod_id: number
  vod_name: string
  vod_pic?: string
  vod_remarks?: string
  sourceId: string
  sourceName: string
  sourceType?: string
  sourceApiUrl: string
  episodes?: EpisodeData[]
  currentEpisodeIndex: number
  timestamp: number
}

const STORAGE_KEY = 'watchHistory'
const MAX_HISTORY = 50

export const WatchHistory = {
  getAll(): WatchHistoryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  add(item: Omit<WatchHistoryItem, 'id' | 'timestamp'>): string {
    const history = this.getAll()
    const existingIndex = history.findIndex(h => h.vod_id === item.vod_id && h.sourceId === item.sourceId)
    
    if (existingIndex !== -1) {
      const existing = history[existingIndex]
      const updated: WatchHistoryItem = {
        ...existing,
        ...item,
        id: existing.id,
        timestamp: Date.now()
      }
      history.splice(existingIndex, 1)
      history.unshift(updated)
    } else {
      const newItem: WatchHistoryItem = {
        ...item,
        id: `${item.sourceId}_${item.vod_id}_${Date.now()}`,
        timestamp: Date.now()
      }
      history.unshift(newItem)
    }

    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    return history[0].id
  },

  updateEpisode(id: string, episodeIndex: number): void {
    const history = this.getAll()
    const item = history.find(h => h.id === id)
    if (item) {
      item.currentEpisodeIndex = episodeIndex
      item.timestamp = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  remove(id: string): void {
    const history = this.getAll()
    const index = history.findIndex(h => h.id === id)
    if (index !== -1) {
      history.splice(index, 1)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}
