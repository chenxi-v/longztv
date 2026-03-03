export interface EpisodeData {
  label: string
  url: string
  index: number
}

export interface PlayHistoryItem {
  id: string
  title: string
  sourceName: string
  source: string
  cover: string
  year: string
  index: number
  totalEpisodes: number
  searchTitle: string
  saveTime: number
}

const STORAGE_KEY = 'playHistory'
const MAX_HISTORY = 50

export const PlayHistory = {
  getAll(): PlayHistoryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  add(item: Omit<PlayHistoryItem, 'id' | 'saveTime'>): string {
    const history = this.getAll()
    const existingIndex = history.findIndex(h => 
      h.title === item.title && 
      h.sourceName === item.sourceName
    )
    
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1)
    }
    
    const newItem: PlayHistoryItem = {
      ...item,
      id: item.source 
        ? `${item.source}_${item.searchTitle}_${Date.now()}`
        : `${item.sourceName}_${item.searchTitle}_${Date.now()}`,
      saveTime: Date.now()
    }
    history.unshift(newItem)
    
    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY)
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    return newItem.id
  },

  updateEpisode(title: string, sourceName: string, index: number): void {
    const history = this.getAll()
    const item = history.find(h => h.title === title && h.sourceName === sourceName)
    if (item) {
      item.index = index
      item.saveTime = Date.now()
      const updatedItem = history.splice(history.indexOf(item), 1)[0]
      history.unshift(updatedItem)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  remove(id: string): void {
    const history = this.getAll().filter(h => h.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}
