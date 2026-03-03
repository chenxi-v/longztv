// ==================== 认证工具函数 ====================

import type { AuthInfo } from './types'

// 从 Cookie 获取认证信息（客户端使用）
export function getAuthInfoFromBrowserCookie(): AuthInfo | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    // 解析 document.cookie
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const trimmed = cookie.trim()
      const firstEqualIndex = trimmed.indexOf('=')

      if (firstEqualIndex > 0) {
        const key = trimmed.substring(0, firstEqualIndex)
        const value = trimmed.substring(firstEqualIndex + 1)
        if (key && value) {
          acc[key] = value
        }
      }

      return acc
    }, {} as Record<string, string>)

    const authCookie = cookies['auth']
    if (!authCookie) {
      return null
    }

    // 处理可能的双重编码
    let decoded = decodeURIComponent(authCookie)

    // 如果解码后仍然包含 %，说明是双重编码，需要再次解码
    if (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded)
    }

    const authData = JSON.parse(decoded)
    return authData
  } catch (error) {
    console.error('解析认证 Cookie 失败:', error)
    return null
  }
}

// 生成签名（使用 Web Crypto API）
export async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // 生成签名
  const signature = await crypto.subtle.sign('HMAC', key, messageData)

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// 验证签名
export async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
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

// 设置认证 Cookie
export function setAuthCookie(authData: AuthInfo, expiresDays: number = 7): void {
  const expires = new Date()
  expires.setDate(expires.getDate() + expiresDays)

  const cookieValue = encodeURIComponent(JSON.stringify(authData))
  document.cookie = `auth=${cookieValue}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`
}

// 清除认证 Cookie
export function clearAuthCookie(): void {
  document.cookie = 'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
}

// 检查是否已登录
export function isAuthenticated(): boolean {
  const authInfo = getAuthInfoFromBrowserCookie()
  return authInfo !== null && !!authInfo.username
}

// 获取当前用户名
export function getCurrentUsername(): string | null {
  const authInfo = getAuthInfoFromBrowserCookie()
  return authInfo?.username || null
}

// 获取当前用户角色
export function getCurrentUserRole(): 'owner' | 'admin' | 'user' | null {
  const authInfo = getAuthInfoFromBrowserCookie()
  return authInfo?.role || null
}
