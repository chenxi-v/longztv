// ==================== 登录弹窗组件 ====================

import { useState, useEffect } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'
import { setAuthCookie } from '../lib/auth'
import { handleLogin } from '../lib/api/login'
import type { AuthInfo } from '../lib/types'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (username: string) => void
  storageType: 'local' | 'upstash'
}

export function LoginModal({ isOpen, onClose, onLoginSuccess, storageType }: LoginModalProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showUsername, setShowUsername] = useState(false)

  // 根据存储类型决定是否显示用户名输入框
  useEffect(() => {
    setShowUsername(storageType === 'upstash')
  }, [storageType])

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  // 处理登录
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!password || (showUsername && !username)) {
      setError('请填写所有必填项')
      return
    }

    try {
      setLoading(true)

      // 调用登录 API
      const result = await handleLogin({
        password,
        ...(showUsername ? { username } : {}),
      })

      if (result.ok) {
        // 登录成功，设置认证 Cookie
        const authData: AuthInfo = {
          username: showUsername ? username : 'user',
          role: (result.role as 'owner' | 'admin' | 'user') || 'user',
          timestamp: Date.now(),
        }

        // 如果有签名，添加到认证数据
        if (result.signature) {
          authData.signature = result.signature
        }

        setAuthCookie(authData, 7)
        onLoginSuccess(showUsername ? username : 'user')
        onClose()
      } else {
        setError(result.error || '登录失败')
      }
    } catch (err) {
      console.error('登录失败:', err)
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 处理遮罩层点击
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="login-modal-overlay" onClick={handleOverlayClick}>
      <div className="login-modal">
        {/* 关闭按钮 */}
        <button className="login-modal-close" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        {/* 标题 */}
        <h2 className="login-modal-title">LongTV</h2>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* 用户名输入（仅 Upstash 模式显示） */}
          {showUsername && (
            <div className="login-input-group">
              <label htmlFor="username" className="sr-only">
                用户名
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                className="login-input"
                placeholder="输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {/* 密码输入 */}
          <div className="login-input-group">
            <label htmlFor="password" className="sr-only">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="login-input"
              placeholder="输入访问密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="login-error">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            className="login-button"
            disabled={!password || loading || (showUsername && !username)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>登录中...</span>
              </>
            ) : (
              <span>登录</span>
            )}
          </button>
        </form>

        {/* 提示信息 */}
        <p className="login-hint">
          {storageType === 'upstash' 
            ? '请输入用户名和密码登录' 
            : '请输入访问密码登录'}
        </p>
      </div>
    </div>
  )
}
