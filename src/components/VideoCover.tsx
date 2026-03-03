import { useState, useCallback } from 'react'
import { Film } from 'lucide-react'

interface VideoCoverProps {
  src?: string
  alt: string
  maxRetries?: number
  ratio?: '3:4' | '16:9'
}

function VideoCover({ src, alt, maxRetries = 3, ratio = '3:4' }: VideoCoverProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  const handleError = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1)
    } else {
      setFailed(true)
      setLoading(false)
    }
  }, [retryCount, maxRetries])

  const handleLoad = useCallback(() => {
    setLoading(false)
    setFailed(false)
  }, [])

  const ratioClass = ratio === '16:9' ? 'ratio-16-9' : ''

  if (!src || failed) {
    return (
      <div className={`video-cover video-cover-placeholder ${ratioClass}`}>
        <Film size={48} className="placeholder-icon" />
        <span className="placeholder-text">{alt}</span>
      </div>
    )
  }

  return (
    <div className={`video-cover ${ratioClass}`}>
      {loading && (
        <div className="video-cover-loading">
          <Film size={32} className="loading-icon" />
        </div>
      )}
      <img 
        key={retryCount}
        src={src} 
        alt={alt} 
        onLoad={handleLoad}
        onError={handleError}
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  )
}

export default VideoCover
