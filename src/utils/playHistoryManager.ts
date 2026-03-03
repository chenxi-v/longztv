// ==================== 播放历史管理器（支持数据库和本地存储） ====================

import { db } from '../lib/db'
import { isUsingDatabase } from '../lib/api/login'
import type { PlayRecord } from '../lib/types'

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

// 本地存储操作
const LocalStorageOps = {
  getAll(): PlayHistoryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  },

  save(history: PlayHistoryItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}

// 播放历史管理器
export const PlayHistoryManager = {
  // 获取所有播放历史
  async getAll(userName: string): Promise<PlayHistoryItem[]> {
    try {
      console.log('[PlayHistoryManager] getAll called, userName:', userName, 'isUsingDatabase:', isUsingDatabase())
      
      if (isUsingDatabase()) {
        // 从数据库加载
        console.log('[PlayHistoryManager] 从数据库加载播放历史...')
        const records = await db.getAllPlayRecords(userName)
        console.log('[PlayHistoryManager] 数据库返回的记录:', records)
        
        const history: PlayHistoryItem[] = Object.entries(records).map(([key, record]) => {
          console.log('[PlayHistoryManager] 处理记录:', { key, record })
          return {
            id: key,
            title: record.title,
            sourceName: record.sourceName,
            source: record.source,
            cover: record.cover,
            year: '',
            index: record.index,
            totalEpisodes: record.totalEpisodes,
            searchTitle: record.searchTitle,
            saveTime: record.saveTime
          }
        })
        
        // 按保存时间降序排序
        history.sort((a, b) => b.saveTime - a.saveTime)
        console.log('[PlayHistoryManager] 最终历史记录:', history)
        return history
      } else {
        // 从本地存储加载
        console.log('[PlayHistoryManager] 从本地存储加载播放历史...')
        return LocalStorageOps.getAll()
      }
    } catch (error) {
      console.error('[PlayHistoryManager] 获取播放历史失败:', error)
      return LocalStorageOps.getAll()
    }
  },

  // 添加播放历史
  async add(userName: string, item: Omit<PlayHistoryItem, 'id' | 'saveTime'>): Promise<string> {
    try {
      const id = `${item.source}+${item.searchTitle}`
      const saveTime = Date.now()
      
      console.log('[PlayHistoryManager] add called:', {
        userName,
        id,
        isUsingDatabase: isUsingDatabase(),
        item
      })
      
      if (isUsingDatabase()) {
        // 保存到数据库
        const record: PlayRecord = {
          source: item.source,
          sourceName: item.sourceName,
          id: item.searchTitle,
          searchTitle: item.searchTitle,
          title: item.title,
          cover: item.cover,
          index: item.index,
          totalEpisodes: item.totalEpisodes,
          saveTime
        }
        console.log('[PlayHistoryManager] 保存到数据库:', { userName, source: item.source, searchTitle: item.searchTitle, record })
        await db.savePlayRecord(userName, item.source, item.searchTitle, record)
        console.log('[PlayHistoryManager] 数据库保存成功')
        return id
      } else {
        // 保存到本地存储
        const history = LocalStorageOps.getAll()
        
        // 移除已存在的项
        const existingIndex = history.findIndex(h => 
          h.title === item.title && 
          h.sourceName === item.sourceName
        )
        if (existingIndex !== -1) {
          history.splice(existingIndex, 1)
        }
        
        // 添加新项
        const newItem: PlayHistoryItem = {
          ...item,
          id,
          saveTime
        }
        history.unshift(newItem)
        
        // 限制最大数量
        if (history.length > MAX_HISTORY) {
          history.splice(MAX_HISTORY)
        }
        
        LocalStorageOps.save(history)
        return id
      }
    } catch (error) {
      console.error('添加播放历史失败:', error)
      // 降级到本地存储
      const history = LocalStorageOps.getAll()
      const id = `${item.source}+${item.searchTitle}`
      const saveTime = Date.now()
      
      const existingIndex = history.findIndex(h => 
        h.title === item.title && 
        h.sourceName === item.sourceName
      )
      if (existingIndex !== -1) {
        history.splice(existingIndex, 1)
      }
      
      const newItem: PlayHistoryItem = {
        ...item,
        id,
        saveTime
      }
      history.unshift(newItem)
      
      if (history.length > MAX_HISTORY) {
        history.splice(MAX_HISTORY)
      }
      
      LocalStorageOps.save(history)
      return id
    }
  },

  // 更新集数
  async updateEpisode(userName: string, title: string, sourceName: string, source: string, searchTitle: string, index: number): Promise<void> {
    try {
      if (isUsingDatabase()) {
        // 更新数据库
        const record = await db.getPlayRecord(userName, source, searchTitle)
        if (record) {
          record.index = index
          record.saveTime = Date.now()
          await db.savePlayRecord(userName, source, searchTitle, record)
        }
      } else {
        // 更新本地存储
        const history = LocalStorageOps.getAll()
        const item = history.find(h => h.title === title && h.sourceName === sourceName)
        if (item) {
          item.index = index
          item.saveTime = Date.now()
          const updatedItem = history.splice(history.indexOf(item), 1)[0]
          history.unshift(updatedItem)
          LocalStorageOps.save(history)
        }
      }
    } catch (error) {
      console.error('更新播放历史失败:', error)
    }
  },

  // 删除播放历史
  async remove(userName: string, id: string): Promise<void> {
    try {
      if (isUsingDatabase()) {
        // 解析 id (格式: source+searchTitle)
        const parts = id.split('+')
        if (parts.length >= 2) {
          const source = parts[0]
          const searchTitle = parts.slice(1).join('+') // 处理 searchTitle 中可能包含的 +
          await db.deletePlayRecord(userName, source, searchTitle)
        }
      } else {
        // 从本地存储删除
        const history = LocalStorageOps.getAll().filter(h => h.id !== id)
        LocalStorageOps.save(history)
      }
    } catch (error) {
      console.error('删除播放历史失败:', error)
      // 降级到本地存储
      const history = LocalStorageOps.getAll().filter(h => h.id !== id)
      LocalStorageOps.save(history)
    }
  },

  // 清空播放历史
  async clear(userName: string): Promise<void> {
    try {
      if (isUsingDatabase()) {
        // 从数据库清空
        const records = await db.getAllPlayRecords(userName)
        for (const key of Object.keys(records)) {
          // 解析 key (格式: source+searchTitle)
          const parts = key.split('+')
          if (parts.length >= 2) {
            const source = parts[0]
            const searchTitle = parts.slice(1).join('+')
            await db.deletePlayRecord(userName, source, searchTitle)
          }
        }
      } else {
        // 从本地存储清空
        LocalStorageOps.clear()
      }
    } catch (error) {
      console.error('清空播放历史失败:', error)
      LocalStorageOps.clear()
    }
  }
}

// 保持向后兼容的同步接口（仅用于本地存储模式）
export const PlayHistory = {
  getAll(): PlayHistoryItem[] {
    return LocalStorageOps.getAll()
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
    
    const id = `${item.source}+${item.searchTitle}`
    const newItem: PlayHistoryItem = {
      ...item,
      id,
      saveTime: Date.now()
    }
    history.unshift(newItem)
    
    if (history.length > MAX_HISTORY) {
      history.splice(MAX_HISTORY)
    }
    
    LocalStorageOps.save(history)
    return id
  },

  updateEpisode(title: string, sourceName: string, index: number): void {
    const history = this.getAll()
    const item = history.find(h => h.title === title && h.sourceName === sourceName)
    if (item) {
      item.index = index
      item.saveTime = Date.now()
      const updatedItem = history.splice(history.indexOf(item), 1)[0]
      history.unshift(updatedItem)
      LocalStorageOps.save(history)
    }
  },

  remove(id: string): void {
    const history = this.getAll().filter(h => h.id !== id)
    LocalStorageOps.save(history)
  },

  clear(): void {
    LocalStorageOps.clear()
  }
}
