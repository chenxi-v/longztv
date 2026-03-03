// ==================== Upstash Redis 数据库适配层 ====================

import { Redis } from '@upstash/redis'
import type { IStorage, PlayRecord, Favorite, SkipConfig, VideoSource } from './types'

// 搜索历史最大条数
const SEARCH_HISTORY_LIMIT = 20

// 数据类型转换辅助函数
function ensureString(value: unknown): string {
  return String(value)
}

function ensureStringArray(value: unknown[]): string[] {
  return value.map((item) => String(item))
}

// Upstash Redis 操作重试包装器
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (err: unknown) {
      const error = err as Error
      const isLastAttempt = i === maxRetries - 1
      const isConnectionError =
        error.message?.includes('Connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ENOTFOUND') ||
        (error as Error & { code?: string }).code === 'ECONNRESET' ||
        (error as Error & { code?: string }).code === 'EPIPE' ||
        error.name === 'UpstashError'

      if (isConnectionError && !isLastAttempt) {
        console.log(`Upstash Redis 操作失败，重试中... (${i + 1}/${maxRetries})`)
        console.error('错误:', error.message)

        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        continue
      }

      throw err
    }
  }

  throw new Error('超过最大重试次数')
}

// 单例 Upstash Redis 客户端
let redisClient: Redis | null = null

function getUpstashRedisClient(): Redis {
  if (redisClient) {
    return redisClient
  }

  const upstashUrl = import.meta.env.VITE_UPSTASH_URL
  const upstashToken = import.meta.env.VITE_UPSTASH_TOKEN

  if (!upstashUrl || !upstashToken) {
    throw new Error('必须设置 VITE_UPSTASH_URL 和 VITE_UPSTASH_TOKEN 环境变量')
  }

  // 创建 Upstash Redis 客户端
  redisClient = new Redis({
    url: upstashUrl,
    token: upstashToken,
    retry: {
      retries: 3,
      backoff: (retryCount: number) => Math.min(1000 * Math.pow(2, retryCount), 30000),
    },
  })

  console.log('Upstash Redis 客户端创建成功')

  return redisClient
}

export class UpstashRedisStorage implements IStorage {
  private client: Redis

  constructor() {
    this.client = getUpstashRedisClient()
  }

  // ==================== 播放记录 ====================
  private prKey(user: string, key: string) {
    return `u:${user}:pr:${key}` // u:username:pr:source+id
  }

  async getPlayRecord(userName: string, key: string): Promise<PlayRecord | null> {
    const val = await withRetry(() => this.client.get(this.prKey(userName, key)))
    return val ? (val as PlayRecord) : null
  }

  async setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void> {
    await withRetry(() => this.client.set(this.prKey(userName, key), record))
  }

  async getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>> {
    const pattern = `u:${userName}:pr:*`
    const keys: string[] = await withRetry(() => this.client.keys(pattern))
    if (keys.length === 0) return {}

    const result: Record<string, PlayRecord> = {}
    for (const fullKey of keys) {
      const value = await withRetry(() => this.client.get(fullKey))
      if (value) {
        // 截取 source+id 部分
        const keyPart = ensureString(fullKey.replace(`u:${userName}:pr:`, ''))
        result[keyPart] = value as PlayRecord
      }
    }
    return result
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.prKey(userName, key)))
  }

  // ==================== 收藏 ====================
  private favKey(user: string, key: string) {
    return `u:${user}:fav:${key}`
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const val = await withRetry(() => this.client.get(this.favKey(userName, key)))
    return val ? (val as Favorite) : null
  }

  async setFavorite(userName: string, key: string, favorite: Favorite): Promise<void> {
    await withRetry(() => this.client.set(this.favKey(userName, key), favorite))
  }

  async getAllFavorites(userName: string): Promise<Record<string, Favorite>> {
    const pattern = `u:${userName}:fav:*`
    const keys: string[] = await withRetry(() => this.client.keys(pattern))
    if (keys.length === 0) return {}

    const result: Record<string, Favorite> = {}
    for (const fullKey of keys) {
      const value = await withRetry(() => this.client.get(fullKey))
      if (value) {
        const keyPart = ensureString(fullKey.replace(`u:${userName}:fav:`, ''))
        result[keyPart] = value as Favorite
      }
    }
    return result
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    await withRetry(() => this.client.del(this.favKey(userName, key)))
  }

  // ==================== 用户注册 / 登录 ====================
  private userPwdKey(user: string) {
    return `u:${user}:pwd`
  }

  async registerUser(userName: string, password: string): Promise<void> {
    // 简单存储明文密码，生产环境应加密
    await withRetry(() => this.client.set(this.userPwdKey(userName), password))
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const stored = await withRetry(() => this.client.get(this.userPwdKey(userName)))
    if (stored === null) return false
    // 确保比较时都是字符串类型
    return ensureString(stored) === password
  }

  async checkUserExist(userName: string): Promise<boolean> {
    const exists = await withRetry(() => this.client.exists(this.userPwdKey(userName)))
    return exists === 1
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await withRetry(() => this.client.set(this.userPwdKey(userName), newPassword))
  }

  async deleteUser(userName: string): Promise<void> {
    // 删除用户密码
    await withRetry(() => this.client.del(this.userPwdKey(userName)))

    // 删除搜索历史
    await withRetry(() => this.client.del(this.shKey(userName)))

    // 删除播放记录
    const playRecordPattern = `u:${userName}:pr:*`
    const playRecordKeys = await withRetry(() => this.client.keys(playRecordPattern))
    if (playRecordKeys.length > 0) {
      await withRetry(() => this.client.del(...playRecordKeys))
    }

    // 删除收藏夹
    const favoritePattern = `u:${userName}:fav:*`
    const favoriteKeys = await withRetry(() => this.client.keys(favoritePattern))
    if (favoriteKeys.length > 0) {
      await withRetry(() => this.client.del(...favoriteKeys))
    }

    // 删除跳过片头片尾配置
    const skipConfigPattern = `u:${userName}:skip:*`
    const skipConfigKeys = await withRetry(() => this.client.keys(skipConfigPattern))
    if (skipConfigKeys.length > 0) {
      await withRetry(() => this.client.del(...skipConfigKeys))
    }

    // 删除视频源配置
    await withRetry(() => this.client.del(this.sourcesKey(userName)))
  }

  // ==================== 搜索历史 ====================
  private shKey(user: string) {
    return `u:${user}:sh` // u:username:sh
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const result = await withRetry(() => this.client.lrange(this.shKey(userName), 0, -1))
    // 确保返回的都是字符串类型
    return ensureStringArray(result as unknown[])
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const key = this.shKey(userName)
    // 先去重
    await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)))
    // 插入到最前
    await withRetry(() => this.client.lpush(key, ensureString(keyword)))
    // 限制最大长度
    await withRetry(() => this.client.ltrim(key, 0, SEARCH_HISTORY_LIMIT - 1))
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const key = this.shKey(userName)
    if (keyword) {
      await withRetry(() => this.client.lrem(key, 0, ensureString(keyword)))
    } else {
      await withRetry(() => this.client.del(key))
    }
  }

  // ==================== 获取全部用户 ====================
  async getAllUsers(): Promise<string[]> {
    const keys = await withRetry(() => this.client.keys('u:*:pwd'))
    return keys
      .map((k) => {
        const match = k.match(/^u:(.+?):pwd$/)
        return match ? ensureString(match[1]) : undefined
      })
      .filter((u): u is string => typeof u === 'string')
  }

  // ==================== 跳过片头片尾配置 ====================
  private skipConfigKey(user: string, source: string, id: string) {
    return `u:${user}:skip:${source}+${id}`
  }

  async getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null> {
    const val = await withRetry(() => this.client.get(this.skipConfigKey(userName, source, id)))
    return val ? (val as SkipConfig) : null
  }

  async setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void> {
    await withRetry(() => this.client.set(this.skipConfigKey(userName, source, id), config))
  }

  async deleteSkipConfig(userName: string, source: string, id: string): Promise<void> {
    await withRetry(() => this.client.del(this.skipConfigKey(userName, source, id)))
  }

  async getAllSkipConfigs(userName: string): Promise<Record<string, SkipConfig>> {
    const pattern = `u:${userName}:skip:*`
    const keys = await withRetry(() => this.client.keys(pattern))

    if (keys.length === 0) {
      return {}
    }

    const configs: Record<string, SkipConfig> = {}

    // 批量获取所有配置
    const values = await withRetry(() => this.client.mget(keys))

    keys.forEach((key, index) => {
      const value = values[index]
      if (value) {
        // 从 key 中提取 source+id
        const match = key.match(/^u:.+?:skip:(.+)$/)
        if (match) {
          const sourceAndId = match[1]
          configs[sourceAndId] = value as SkipConfig
        }
      }
    })

    return configs
  }

  // ==================== 视频源配置 ====================
  private sourcesKey(user: string) {
    return `u:${user}:sources`
  }

  async getVideoSources(userName: string): Promise<VideoSource[]> {
    const val = await withRetry(() => this.client.get(this.sourcesKey(userName)))
    return val ? (val as VideoSource[]) : []
  }

  async setVideoSources(userName: string, sources: VideoSource[]): Promise<void> {
    await withRetry(() => this.client.set(this.sourcesKey(userName), sources))
  }

  // 清空所有数据
  async clearAllData(): Promise<void> {
    try {
      // 获取所有用户
      const allUsers = await this.getAllUsers()

      // 删除所有用户及其数据
      for (const username of allUsers) {
        await this.deleteUser(username)
      }

      console.log('所有数据已清空')
    } catch (error) {
      console.error('清空数据失败:', error)
      throw new Error('清空数据失败')
    }
  }
}
