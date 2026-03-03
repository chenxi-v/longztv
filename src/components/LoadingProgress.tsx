import { useState, useEffect } from 'react'
import './LoadingProgress.css'

interface LoadingProgressProps {
  text?: string
}

function LoadingProgress({ text = '加载中' }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) {
          return prev
        }
        const increment = Math.random() * 15 + 5
        return Math.min(prev + increment, 99)
      })
    }, 200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-progress-container">
      <div className="loading-progress-bar">
        <div 
          className="loading-progress-fill" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="loading-progress-text">
        <span>{text}</span>
        <span className="loading-progress-percent">{Math.floor(progress)}%</span>
      </div>
    </div>
  )
}

export default LoadingProgress
