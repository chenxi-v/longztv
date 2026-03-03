// ==================== 数据库管理器 ====================

import type { IStorage, PlayRecord, Favorite, SkipConfig, VideoSource } from './types'
import { UpstashRedisStorage } from './upstash.db'

// 存储类型
type StorageType = 'local' | 'upstash'

// 获取存储类型
const STORAGE_TYPE: StorageType = (import.meta.env.VITE_STORAGE_TYPE as StorageType) || 'local'

console.log('[DbManager] 存储类型:', STORAGE_TYPE)
console.log('[DbManager] 环境变量:', {
  VITE_STORAGE_TYPE: import.meta.env.VITE_STORAGE_TYPE,
  VITE_UPSTASH_URL: import.meta.env.VITE_UPSTASH_URL ? '已设置' : '未设置',
  VITE_UPSTASH_TOKEN: import.meta.env.VITE_UPSTASH_TOKEN ? '已设置' : '未设置'
})

// 创建存储实例
function createStorage(): IStorage | null {
  console.log('[DbManager] createStorage called, STORAGE_TYPE:', STORAGE_TYPE)
  switch (STORAGE_TYPE) {
    case 'upstash':
      console.log('[DbManager] 创建 UpstashRedisStorage 实例')
      try {
        const storage = new UpstashRedisStorage()
        console.log('[DbManager] UpstashRedisStorage 创建成功')
        return storage
      } catch (error) {
        console.error('[DbManager] UpstashRedisStorage 创建失败:', error)
        return null
      }
    case 'local':
    default:
      console.log('[DbManager] 使用 localStorage')
      return null // 使用 localStorage
  }
}

// 单例存储实例
let storageInstance: IStorage | null = null

function getStorage(): IStorage | null {
  if (!storageInstance) {
    storageInstance = createStorage()
  }
  return storageInstance
}

// 工具函数：生成存储 key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`
}

// LocalStorage 辅助函数
function getLocalStorageKey(userName: string, type: string, key?: string): string {
  return key ? `longtv_${userName}_${type}_${key}` : `longtv_${userName}_${type}`
}

// 数据库管理器
export class DbManager {
  private storage: IStorage | null

  constructor() {
    this.storage = getStorage()
  }

  // 获取当前存储类型
  getStorageType(): StorageType {
    return STORAGE_TYPE
  }

  // 是否使用数据库
  isUsingDatabase(): boolean {
    return this.storage !== null
  }

  // ==================== 播放记录 ====================
  async getPlayRecord(userName: string, source: string, id: string): Promise<PlayRecord | null> {
    const key = generateStorageKey(source, id)
    if (this.storage) {
      return this.storage.getPlayRecord(userName, key)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'pr', key)
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : null
  }

  async savePlayRecord(userName: string, source: string, id: string, record: PlayRecord): Promise<void> {
    const key = generateStorageKey(source, id)
    console.log('[DbManager] savePlayRecord:', { userName, source, id, key, hasStorage: !!this.storage })
    if (this.storage) {
      console.log('[DbManager] 使用数据库存储')
      await this.storage.setPlayRecord(userName, key, record)
      console.log('[DbManager] 数据库存储完成')
      return
    }
    // LocalStorage 降级
    console.log('[DbManager] 使用本地存储')
    const storageKey = getLocalStorageKey(userName, 'pr', key)
    localStorage.setItem(storageKey, JSON.stringify(record))
  }

  async getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>> {
    if (this.storage) {
      return this.storage.getAllPlayRecords(userName)
    }
    // LocalStorage 降级
    const result: Record<string, PlayRecord> = {}
    const prefix = getLocalStorageKey(userName, 'pr', '')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const data = localStorage.getItem(key)
        if (data) {
          const keyPart = key.replace(prefix, '')
          result[keyPart] = JSON.parse(data)
        }
      }
    }
    return result
  }

  async deletePlayRecord(userName: string, source: string, id: string): Promise<void> {
    const key = generateStorageKey(source, id)
    if (this.storage) {
      await this.storage.deletePlayRecord(userName, key)
      return
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'pr', key)
    localStorage.removeItem(storageKey)
  }

  // ==================== 收藏 ====================
  async getFavorite(userName: string, source: string, id: string): Promise<Favorite | null> {
    const key = generateStorageKey(source, id)
    if (this.storage) {
      return this.storage.getFavorite(userName, key)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'fav', key)
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : null
  }

  async saveFavorite(userName: string, source: string, id: string, favorite: Favorite): Promise<void> {
    const key = generateStorageKey(source, id)
    if (this.storage) {
      await this.storage.setFavorite(userName, key, favorite)
      return
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'fav', key)
    localStorage.setItem(storageKey, JSON.stringify(favorite))
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    if (this.storage) {
      return this.storage.getAllFavorites(userName)
    }
    // LocalStorage 降级
    const result: Record<string, Favorite> = {}
    const prefix = getLocalStorageKey(userName, 'fav', '')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const data = localStorage.getItem(key)
        if (data) {
          const keyPart = key.replace(prefix, '')
          result[keyPart] = JSON.parse(data)
        }
      }
    }
    return result
  }

  async deleteFavorite(userName: string, source: string, id: string): Promise<void> {
    const key = generateStorageKey(source, id)
    if (this.storage) {
      await this.storage.deleteFavorite(userName, key)
      return
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'fav', key)
    localStorage.removeItem(storageKey)
  }

  async isFavorited(userName: string, source: string, id: string): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id)
    return favorite !== null
  }

  // ==================== 用户 ====================
  async registerUser(userName: string, password: string): Promise<void> {
    if (this.storage) {
      return this.storage.registerUser(userName, password)
    }
    // LocalStorage 不支持用户注册
    throw new Error('LocalStorage 模式不支持用户注册')
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    if (this.storage) {
      return this.storage.verifyUser(userName, password)
    }
    // LocalStorage 不支持用户验证
    throw new Error('LocalStorage 模式不支持用户验证')
  }

  async checkUserExist(userName: string): Promise<boolean> {
    if (this.storage) {
      return this.storage.checkUserExist(userName)
    }
    // LocalStorage 不支持用户检查
    throw new Error('LocalStorage 模式不支持用户检查')
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    if (this.storage) {
      return this.storage.changePassword(userName, newPassword)
    }
    // LocalStorage 不支持修改密码
    throw new Error('LocalStorage 模式不支持修改密码')
  }

  async deleteUser(userName: string): Promise<void> {
    if (this.storage) {
      return this.storage.deleteUser(userName)
    }
    // LocalStorage 不支持删除用户
    throw new Error('LocalStorage 模式不支持删除用户')
  }

  // ==================== 搜索历史 ====================
  async getSearchHistory(userName: string): Promise<string[]> {
    if (this.storage) {
      return this.storage.getSearchHistory(userName)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'sh')
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : []
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    if (this.storage) {
      return this.storage.addSearchHistory(userName, keyword)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'sh')
    const data = localStorage.getItem(storageKey)
    const history: string[] = data ? JSON.parse(data) : []
    
    // 去重
    const index = history.indexOf(keyword)
    if (index > -1) {
      history.splice(index, 1)
    }
    
    // 插入到最前
    history.unshift(keyword)
    
    // 限制最大长度
    if (history.length > 20) {
      history.pop()
    }
    
    localStorage.setItem(storageKey, JSON.stringify(history))
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (this.storage) {
      return this.storage.deleteSearchHistory(userName, keyword)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'sh')
    if (keyword) {
      const data = localStorage.getItem(storageKey)
      const history: string[] = data ? JSON.parse(data) : []
      const index = history.indexOf(keyword)
      if (index > -1) {
        history.splice(index, 1)
        localStorage.setItem(storageKey, JSON.stringify(history))
      }
    } else {
      localStorage.removeItem(storageKey)
    }
  }

  // ==================== 跳过配置 ====================
  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    if (this.storage) {
      return this.storage.getSkipConfig(userName, source, id)
    }
    // LocalStorage 降级
    const key = generateStorageKey(source, id)
    const storageKey = getLocalStorageKey(userName, 'skip', key)
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : null
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    if (this.storage) {
      return this.storage.setSkipConfig(userName, source, id, config)
    }
    // LocalStorage 降级
    const key = generateStorageKey(source, id)
    const storageKey = getLocalStorageKey(userName, 'skip', key)
    localStorage.setItem(storageKey, JSON.stringify(config))
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    if (this.storage) {
      return this.storage.deleteSkipConfig(userName, source, id)
    }
    // LocalStorage 降级
    const key = generateStorageKey(source, id)
    const storageKey = getLocalStorageKey(userName, 'skip', key)
    localStorage.removeItem(storageKey)
  }

  async getAllSkipConfigs(userName: string): Promise<Record<string, SkipConfig>> {
    if (this.storage) {
      return this.storage.getAllSkipConfigs(userName)
    }
    // LocalStorage 降级
    const result: Record<string, SkipConfig> = {}
    const prefix = getLocalStorageKey(userName, 'skip', '')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const data = localStorage.getItem(key)
        if (data) {
          const keyPart = key.replace(prefix, '')
          result[keyPart] = JSON.parse(data)
        }
      }
    }
    return result
  }

  // ==================== 视频源配置 ====================
  async getVideoSources(userName: string): Promise<VideoSource[]> {
    if (this.storage) {
      return this.storage.getVideoSources(userName)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'sources')
    const data = localStorage.getItem(storageKey)
    return data ? JSON.parse(data) : []
  }

  async setVideoSources(userName: string, sources: VideoSource[]): Promise<void> {
    if (this.storage) {
      return this.storage.setVideoSources(userName, sources)
    }
    // LocalStorage 降级
    const storageKey = getLocalStorageKey(userName, 'sources')
    localStorage.setItem(storageKey, JSON.stringify(sources))
  }

  // ==================== 用户管理 ====================
  async getAllUsers(): Promise<string[]> {
    if (this.storage) {
      return this.storage.getAllUsers()
    }
    // LocalStorage 不支持获取所有用户
    return []
  }
}

// 导出默认实例
export const db = new DbManager()
