// ==================== 数据类型定义 ====================

// 播放记录
export interface PlayRecord {
  source: string
  sourceName: string
  id: string
  searchTitle: string
  title: string
  cover: string
  index: number
  totalEpisodes: number
  saveTime: number
}

// 收藏
export interface Favorite {
  source: string
  sourceName: string
  id: string
  searchTitle: string
  title: string
  cover: string
  saveTime: number
}

// 跳过片头片尾配置
export interface SkipConfig {
  source: string
  id: string
  skipStart: number
  skipEnd: number
}

// 视频源配置
export interface VideoSource {
  id: number
  name: string
  key: string
  apiUrl: string
  latency?: number | null
  testing?: boolean
  enabled?: boolean
}

// 用户认证信息
export interface AuthInfo {
  username?: string
  password?: string
  signature?: string
  timestamp?: number
  role?: 'owner' | 'admin' | 'user'
}

// 存储接口
export interface IStorage {
  // 播放记录
  getPlayRecord(userName: string, key: string): Promise<PlayRecord | null>
  setPlayRecord(userName: string, key: string, record: PlayRecord): Promise<void>
  getAllPlayRecords(userName: string): Promise<Record<string, PlayRecord>>
  deletePlayRecord(userName: string, key: string): Promise<void>

  // 收藏
  getFavorite(userName: string, key: string): Promise<Favorite | null>
  setFavorite(userName: string, key: string, favorite: Favorite): Promise<void>
  getAllFavorites(userName: string): Promise<Record<string, Favorite>>
  deleteFavorite(userName: string, key: string): Promise<void>

  // 用户
  registerUser(userName: string, password: string): Promise<void>
  verifyUser(userName: string, password: string): Promise<boolean>
  checkUserExist(userName: string): Promise<boolean>
  changePassword(userName: string, newPassword: string): Promise<void>
  deleteUser(userName: string): Promise<void>

  // 搜索历史
  getSearchHistory(userName: string): Promise<string[]>
  addSearchHistory(userName: string, keyword: string): Promise<void>
  deleteSearchHistory(userName: string, keyword?: string): Promise<void>

  // 跳过配置
  getSkipConfig(userName: string, source: string, id: string): Promise<SkipConfig | null>
  setSkipConfig(userName: string, source: string, id: string, config: SkipConfig): Promise<void>
  deleteSkipConfig(userName: string, source: string, id: string): Promise<void>
  getAllSkipConfigs(userName: string): Promise<Record<string, SkipConfig>>

  // 视频源配置
  getVideoSources(userName: string): Promise<VideoSource[]>
  setVideoSources(userName: string, sources: VideoSource[]): Promise<void>

  // 用户管理
  getAllUsers(): Promise<string[]>
}

// 登录响应
export interface LoginResponse {
  ok: boolean
  error?: string
}

// 登录请求
export interface LoginRequest {
  username?: string
  password: string
}
