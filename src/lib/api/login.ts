// ==================== 登录 API 处理 ====================

import { generateSignature } from '../auth'
import { db } from '../db'
import type { LoginRequest, LoginResponse, AuthInfo } from '../types'

// 管理员用户名（从环境变量读取）
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME

// 管理员密码（从环境变量读取）
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

// 存储类型
const STORAGE_TYPE = (import.meta.env.VITE_STORAGE_TYPE as 'local' | 'upstash') || 'local'

// 登录处理函数
export async function handleLogin(request: LoginRequest): Promise<LoginResponse & { role?: string; signature?: string }> {
  try {
    const { username, password } = request

    // Local 模式：仅验证密码
    if (STORAGE_TYPE === 'local') {
      // 未设置密码时直接放行
      if (!ADMIN_PASSWORD) {
        return { ok: true, role: 'user' }
      }

      if (!password || typeof password !== 'string') {
        return { ok: false, error: '密码不能为空' }
      }

      if (password !== ADMIN_PASSWORD) {
        return { ok: false, error: '密码错误' }
      }

      // 验证成功
      return { ok: true, role: 'user' }
    }

    // Upstash 模式：验证用户名和密码
    if (!username || typeof username !== 'string') {
      return { ok: false, error: '用户名不能为空' }
    }
    if (!password || typeof password !== 'string') {
      return { ok: false, error: '密码不能为空' }
    }

    // 检查是否是管理员
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // 管理员验证成功
      const signature = await generateSignature(username, ADMIN_PASSWORD)
      return { ok: true, role: 'owner', signature }
    } else if (username === ADMIN_USERNAME) {
      // 用户名正确但密码错误
      return { ok: false, error: '用户名或密码错误' }
    }

    // 验证普通用户
    try {
      const isValid = await db.verifyUser(username, password)
      if (!isValid) {
        return { ok: false, error: '用户名或密码错误' }
      }

      // 验证成功
      return { ok: true, role: 'user' }
    } catch (err) {
      console.error('数据库验证失败:', err)
      return { ok: false, error: '数据库错误' }
    }
  } catch (error) {
    console.error('登录处理异常:', error)
    return { ok: false, error: '服务器错误' }
  }
}

// 检查是否需要登录
export function isLoginRequired(): boolean {
  // 如果设置了密码，则需要登录
  return !!ADMIN_PASSWORD
}

// 获取存储类型
export function getStorageType(): 'local' | 'upstash' {
  return STORAGE_TYPE
}

// 检查是否使用数据库
export function isUsingDatabase(): boolean {
  const storageType = STORAGE_TYPE
  const hasUrl = !!import.meta.env.VITE_UPSTASH_URL
  const hasToken = !!import.meta.env.VITE_UPSTASH_TOKEN
  const result = storageType === 'upstash' && hasUrl && hasToken
  
  console.log('[isUsingDatabase] 检查:', {
    storageType,
    hasUrl,
    hasToken,
    result
  })
  
  return result
}

// 验证认证信息
export async function verifyAuth(authInfo: AuthInfo): Promise<boolean> {
  if (!authInfo || !authInfo.username) {
    return false
  }

  // Local 模式：验证密码
  if (STORAGE_TYPE === 'local') {
    return authInfo.password === ADMIN_PASSWORD
  }

  // Upstash 模式：验证签名
  if (!authInfo.signature) {
    return false
  }

  // 验证签名
  if (authInfo.username === ADMIN_USERNAME) {
    // 管理员签名验证
    return verifySignature(authInfo.username, authInfo.signature, ADMIN_PASSWORD)
  }

  // 普通用户签名验证（使用管理员密码作为密钥）
  return verifySignature(authInfo.username, authInfo.signature, ADMIN_PASSWORD)
}

// 签名验证辅助函数
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  try {
    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // 将十六进制字符串转换为 Uint8Array
    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    )

    // 验证签名
    return await crypto.subtle.verify('HMAC', key, signatureBuffer, messageData)
  } catch (error) {
    console.error('签名验证失败:', error)
    return false
  }
}
