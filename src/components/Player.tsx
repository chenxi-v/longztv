import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, FileText, List, ArrowLeft, Film, Clock, Calendar, User, Star } from 'lucide-react'
import Artplayer from 'artplayer'
import artplayerPluginLiquidGlass from '../plugins/artplayer-liquid-glass'
import Hls, { 
  type LoaderContext, 
  type LoaderCallbacks, 
  type LoaderResponse, 
  type LoaderStats, 
  type HlsConfig, 
  type LoaderConfiguration,
  ErrorTypes,
} from 'hls.js'
import { PlayHistory as PlayHistoryUtil } from '../utils/playHistory'
import { PlayHistoryManager } from '../utils/playHistoryManager'
import { isUsingDatabase } from '../lib/api/login'
import LoadingProgress from './LoadingProgress'
import '../styles/player.css'

interface VideoSource {
  id: string
  name: string
  key: string
  apiUrl: string
  enabled?: boolean
  type?: 'normal' | 'tvbox'
}

interface Episode {
  label: string
  url: string
  index: number
}

interface VideoItem {
  vod_id: number
  vod_name: string
  vod_en: string
  vod_time: string
  vod_remarks: string
  vod_play_from: string
  vod_pic?: string
  vod_play_url?: string
  vod_actor?: string
  vod_director?: string
  vod_blurb?: string
  vod_area?: string
  vod_year?: string
  vod_score?: string
  vod_content?: string
  type_id: number
  type_name: string
}

interface PlayerProps {
  sourceId: string | null
  videoId: string | null
  videoName?: string
  coverPic?: string
  sources: VideoSource[]
  proxySettings: { enabled: boolean; url: string }
  buildProxyUrl: (apiUrl: string, params?: Record<string, string>) => string
  onBack: () => void
  onOpenHistory?: () => void
  userName?: string
}

function filterAdsFromM3U8(m3u8Content: string) {
  if (!m3u8Content) return ''
  const discontinuityRegex = /#EXT-X-DISCONTINUITY/g
  return m3u8Content.replace(discontinuityRegex, '')
}

const getHlsBufferConfig = () => {
  const mode = typeof window !== 'undefined' ? localStorage.getItem('playerBufferMode') || 'standard' : 'standard'
  switch (mode) {
    case 'enhanced':
      return { maxBufferLength: 45, backBufferLength: 45, maxBufferSize: 90 * 1000 * 1000 }
    case 'max':
      return { maxBufferLength: 90, backBufferLength: 60, maxBufferSize: 180 * 1000 * 1000 }
    default:
      return { maxBufferLength: 30, backBufferLength: 30, maxBufferSize: 60 * 1000 * 1000 }
  }
}

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
const isAndroid = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)
const isMobile = isIOS || isAndroid || (typeof window !== 'undefined' && window.innerWidth < 768)
const isIOS13 = isIOS && typeof window !== 'undefined' && (window as any).webkit?.presentationMode !== undefined

interface ExtendedLoaderContext extends LoaderContext {
  type: string
}

interface ArtplayerWithHls extends Artplayer {
  hls?: Hls
}

class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  constructor(config: HlsConfig) {
    super(config)
    const load = this.load.bind(this)
    this.load = function (
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const ctx = context as ExtendedLoaderContext
      if (ctx.type === 'manifest' || ctx.type === 'level') {
        const onSuccess = callbacks.onSuccess
        callbacks.onSuccess = function (
          response: LoaderResponse,
          stats: LoaderStats,
          context: LoaderContext,
          networkDetails: unknown,
        ) {
          if (response.data && typeof response.data === 'string') {
            response.data = filterAdsFromM3U8(response.data)
          }
          return onSuccess(response, stats, context, networkDetails)
        }
      }
      load(context, config, callbacks)
    }
  }
}

export default function Player({ 
  sourceId, 
  videoId, 
  videoName, 
  coverPic, 
  sources, 
  buildProxyUrl,
  onBack,
  onOpenHistory: _onOpenHistory,
  userName = 'default'
}: PlayerProps) {
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null)
  const [videoDetail, setVideoDetail] = useState<VideoItem | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEpisodeList, setShowEpisodeList] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [playbackStatus, setPlaybackStatus] = useState<string | null>(null)
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('')
  const [currentSourceName, setCurrentSourceName] = useState<string>('')
  const episodesPerPage = 20
  const artRef = useRef<Artplayer | null>(null)
  const videoRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const initPlayerRef = useRef<boolean>(false)

  useEffect(() => {
    console.log('Player useEffect triggered:', { sourceId, videoId, sourcesLength: sources.length })
    
    // 标记为未初始化
    initPlayerRef.current = false
    
    // 清理旧的播放器实例
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (artRef.current) {
      artRef.current.destroy()
      artRef.current = null
    }
    
    // 重置状态
    setVideoDetail(null)
    setEpisodes([])
    setSelectedEpisode(null)
    setError('')
    setLoading(true)
    
    if (sourceId) {
      const source = sources.find(s => s.id === sourceId)
      console.log('Found source:', source)
      if (source) {
        setSelectedSource(source)
        if (videoId) {
          loadVideoDetail(source, videoId)
        } else {
          setError('未提供视频ID')
          setLoading(false)
        }
      } else {
        setError('未找到视频源')
        setLoading(false)
      }
    } else {
      setError('未选择视频源')
      setLoading(false)
    }
  }, [sourceId, videoId])

  const loadVideoDetail = async (source: VideoSource, id: string) => {
    setLoading(true)
    setError('')

    try {
      const params: Record<string, string> = { ac: 'detail', ids: id }
      const proxyUrl = buildProxyUrl(source.apiUrl, params)
      
      const response = await fetch(proxyUrl, { method: 'GET' })
      if (!response.ok) throw new Error('获取视频详情失败')

      const data = await response.json()
      if (data.code === 1 && data.list && data.list.length > 0) {
        const detail = data.list[0]
        
        if (!detail.vod_pic && coverPic) {
          detail.vod_pic = decodeURIComponent(coverPic)
        }
        if (videoName) {
          detail.vod_name = decodeURIComponent(videoName)
        }
        
        setVideoDetail(detail)
        setCurrentVideoTitle(detail.vod_name)
        setCurrentSourceName(source.name)
        
        const parsedEpisodes = parsePlayUrl(detail.vod_play_url || '')
        setEpisodes(parsedEpisodes)
        
        if (parsedEpisodes.length > 0) {
          setSelectedEpisode(parsedEpisodes[0])
          
          // 保存播放历史（支持数据库和本地存储）
          console.log('[Player] 保存播放历史:', {
            userName,
            title: detail.vod_name,
            source: source.id.toString(),
            isUsingDatabase: isUsingDatabase()
          })
          
          PlayHistoryManager.add(userName, {
            title: detail.vod_name,
            sourceName: source.name,
            source: source.id.toString(),
            cover: detail.vod_pic || '',
            year: detail.vod_year || '',
            index: 0,
            totalEpisodes: parsedEpisodes.length,
            searchTitle: detail.vod_id.toString()
          }).then(id => {
            console.log('[Player] 播放历史保存成功, id:', id)
          }).catch(err => {
            console.error('[Player] 保存播放历史失败:', err)
            // 降级到本地存储
            PlayHistoryUtil.add({
              title: detail.vod_name,
              sourceName: source.name,
              source: source.id.toString(),
              cover: detail.vod_pic || '',
              year: detail.vod_year || '',
              index: 0,
              totalEpisodes: parsedEpisodes.length,
              searchTitle: detail.vod_id.toString()
            })
          })
          
          requestAnimationFrame(() => {
            initPlayer(parsedEpisodes[0].url)
          })
        } else {
          setError('未找到可播放的集数')
        }
      } else {
        throw new Error(data.msg || '获取视频详情失败')
      }
    } catch (err) {
      console.error('加载视频详情失败:', err)
      setError(err instanceof Error ? err.message : '获取视频详情失败')
    } finally {
      setLoading(false)
    }
  }

  const parsePlayUrl = (playUrl: string): Episode[] => {
    if (!playUrl) return []
    const episodes: Episode[] = []
    
    let urlContent = playUrl
    if (playUrl.includes('$$$')) {
      const sources = playUrl.split('$$$')
      let m3u8Source = sources.find(s => s.includes('.m3u8') || s.includes('m3u8'))
      urlContent = m3u8Source || sources[0]
    }
    
    const parts = urlContent.split('#')
    
    parts.forEach((part, index) => {
      const [label, url] = part.split('$')
      if (url) {
        episodes.push({
          label: label || `第${index + 1}集`,
          url: url.replace(/\\/g, ''),
          index: index
        })
      }
    })
    
    return episodes
  }

  const initPlayer = useCallback((url: string) => {
    if (!videoRef.current) {
      setPlaybackStatus('播放器初始化失败')
      return
    }

    // 防止重复初始化
    if (initPlayerRef.current) {
      console.log('Player already initializing, skipping...')
      return
    }
    initPlayerRef.current = true

    setPlaybackStatus('正在加载视频...')

    // 先销毁旧的实例
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (artRef.current) {
      artRef.current.destroy()
      artRef.current = null
    }

    // 添加延迟确保旧的播放器完全销毁
    setTimeout(() => {
      if (!videoRef.current) {
        setPlaybackStatus('播放器初始化失败')
        initPlayerRef.current = false
        return
      }

      const isM3U8 = url.includes('.m3u8') || url.includes('m3u8')

      const art = new Artplayer({
        container: videoRef.current,
        url: url,
        type: isM3U8 ? 'm3u8' : 'mp4',
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: false,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: true,
        setting: true,
        loop: false,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: true,
        miniProgressBar: false,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoOrientation: true,
        airplay: isIOS || isAndroid,
        theme: '#0ea5e9',
        lang: 'zh-cn',
        moreVideoAttr: {
          crossOrigin: 'anonymous',
        },
        plugins: [artplayerPluginLiquidGlass()],
        customType: {
          m3u8: (video: HTMLVideoElement, playUrl: string, player: any) => {
            const artWithHls = player as ArtplayerWithHls
            if (Hls.isSupported()) {
            if (artWithHls.hls) artWithHls.hls.destroy()
            
            const bufferConfig = getHlsBufferConfig()
            
            const hlsConfig: Partial<HlsConfig> = {
              debug: false,
              enableWorker: true,
              lowLatencyMode: !isMobile,
              maxBufferLength: isMobile ? (isIOS13 ? 8 : isIOS ? 10 : 15) : bufferConfig.maxBufferLength,
              backBufferLength: isMobile ? (isIOS13 ? 5 : isIOS ? 8 : 10) : bufferConfig.backBufferLength,
              maxBufferSize: isMobile 
                ? (isIOS13 ? 20 * 1000 * 1000 : isIOS ? 30 * 1000 * 1000 : 40 * 1000 * 1000) 
                : bufferConfig.maxBufferSize,
              loader: CustomHlsJsLoader as unknown as typeof Hls.DefaultConfig.loader,
            }
            
            const hls = new Hls(hlsConfig)
            hls.loadSource(playUrl)
            hls.attachMedia(video)
            hlsRef.current = hls
            artWithHls.hls = hls
            player.on('destroy', () => hls.destroy())

            hls.on(Hls.Events.ERROR, (event: any, data: any) => {
              if (data.fatal) {
                console.error('HLS Fatal Error:', event, data)
                initPlayerRef.current = false // 出错时重置标记
                switch (data.type) {
                  case ErrorTypes.NETWORK_ERROR:
                    console.log('网络错误，尝试恢复...')
                    if (artRef.current) {
                      artRef.current.notice.show = '网络错误，请检查链接是否有效'
                    }
                    setPlaybackStatus('网络错误')
                    hls.startLoad()
                    break
                  case ErrorTypes.MEDIA_ERROR:
                    console.log('媒体错误，尝试恢复...')
                    hls.recoverMediaError()
                    break
                  default:
                    console.log('无法恢复的错误')
                    hls.destroy()
                    if (artRef.current) {
                      artRef.current.notice.show = '播放器错误，请检查链接格式'
                    }
                    setPlaybackStatus('播放错误')
                    break
                }
              }
            })
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              setPlaybackStatus('视频加载成功，正在播放...')
            })
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playUrl
            setPlaybackStatus('视频加载成功，正在播放...')
          }
        },
      },
    })

    art.on('ready', () => {
      setPlaybackStatus('播放器已就绪')
      initPlayerRef.current = false // 初始化完成，重置标记
    })

    art.on('error', (error: any) => {
      console.error('Artplayer error:', error)
      initPlayerRef.current = false // 出错时重置标记
    })

    artRef.current = art
    }, 100) // 100ms延迟确保旧播放器完全销毁
  }, [])

  const handleEpisodeSelect = async (episode: Episode) => {
    if (selectedEpisode?.index === episode.index) return
    
    setSelectedEpisode(episode)
    
    if (currentVideoTitle && currentSourceName && selectedSource) {
      // 更新播放历史（支持数据库和本地存储）
      PlayHistoryManager.updateEpisode(
        userName, 
        currentVideoTitle, 
        currentSourceName, 
        selectedSource.id.toString(),
        videoId || '',
        episode.index
      ).catch(err => {
        console.error('更新播放历史失败:', err)
        // 降级到本地存储
        PlayHistoryUtil.updateEpisode(currentVideoTitle, currentSourceName, episode.index)
      })
    }
    
    if (artRef.current && episode.url) {
      // 重置初始化标记，允许重新初始化播放器
      initPlayerRef.current = false
      initPlayer(episode.url)
      artRef.current.play()
    }
  }

  const totalPages = Math.ceil(episodes.length / episodesPerPage)
  const startIndex = (currentPage - 1) * episodesPerPage
  const endIndex = startIndex + episodesPerPage
  const currentEpisodes = episodes.slice(startIndex, endIndex)

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      if (artRef.current) {
        artRef.current.destroy()
        artRef.current = null
      }
    }
  }, [])

  return (
    <div className="player-page">
      <div className="player-container">
        <div className="player-header">
          <h1 className="player-title">视频播放器</h1>
          <button onClick={onBack} className="back-button">
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>
        </div>

        {loading ? (
          <LoadingProgress text="加载视频中" />
        ) : error ? (
          <div className="error-container">
            <p className="error-text">{error}</p>
          </div>
        ) : videoDetail ? (
          <div className="player-content">
            <div className="video-player-wrapper">
              <div className="video-player-header">
                <h2 className="video-title">{videoDetail.vod_name}</h2>
                {selectedSource && (
                  <div className="video-source-info">
                    <span>源：</span>
                    <span className="source-name">{selectedSource.name}</span>
                    {selectedEpisode?.label && (
                      <>
                        <span>·</span>
                        <span>{selectedEpisode.label}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="video-player-container">
                <div ref={videoRef} className="video-player"></div>
                {playbackStatus && (
                  <div className="playback-status">
                    <p>{playbackStatus}</p>
                  </div>
                )}
              </div>
            </div>

            {episodes.length > 0 && (
              <div className="episode-section">
                <div className="episode-header">
                  <h3 className="episode-title">
                    <List className="w-5 h-5" />
                    选集
                    <span className="episode-count">({episodes.length}集)</span>
                  </h3>
                  <button 
                    onClick={() => setShowEpisodeList(!showEpisodeList)}
                    className="toggle-episode-btn"
                  >
                    {showEpisodeList ? '收起' : '展开'}
                  </button>
                </div>

                {showEpisodeList && (
                  <div className="episode-list-container">
                    <div className="episode-grid">
                      {currentEpisodes.map((episode) => (
                        <button
                          key={episode.index}
                          onClick={() => handleEpisodeSelect(episode)}
                          className={`episode-btn ${selectedEpisode?.index === episode.index ? 'active' : ''}`}
                        >
                          {episode.label}
                        </button>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="episode-pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="episode-page-btn"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="episode-page-info">
                          第 {currentPage} / {totalPages} 页
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="episode-page-btn"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 视频详情卡片 */}
            <div className="video-detail-section">
              <div className="video-detail-content">
                {videoDetail.vod_pic ? (
                  <div className="video-poster">
                    <img src={videoDetail.vod_pic} alt={videoDetail.vod_name} />
                  </div>
                ) : (
                  <div className="video-poster-placeholder">
                    <Film className="w-12 h-12" />
                  </div>
                )}
                <div className="video-info">
                  <h2 className="video-info-title">{videoDetail.vod_name}</h2>
                  <div className="video-meta">
                    <div className="meta-item">
                      <Film className="w-4 h-4" />
                      <span>{videoDetail.type_name}</span>
                    </div>
                    {videoDetail.vod_area && (
                      <div className="meta-item">
                        <span className="meta-label">地区：</span>
                        <span>{videoDetail.vod_area}</span>
                      </div>
                    )}
                    {videoDetail.vod_year && (
                      <div className="meta-item">
                        <Calendar className="w-4 h-4" />
                        <span>{videoDetail.vod_year}</span>
                      </div>
                    )}
                    {videoDetail.vod_score && (
                      <div className="meta-item score">
                        <Star className="w-4 h-4" />
                        <span>{videoDetail.vod_score}</span>
                      </div>
                    )}
                    {videoDetail.vod_remarks && (
                      <div className="meta-item remarks">
                        <Clock className="w-4 h-4" />
                        <span>{videoDetail.vod_remarks}</span>
                      </div>
                    )}
                    {videoDetail.vod_actor && (
                      <div className="meta-item actors">
                        <User className="w-4 h-4" />
                        <span>{videoDetail.vod_actor}</span>
                      </div>
                    )}
                    {videoDetail.vod_director && (
                      <div className="meta-item">
                        <span className="meta-label">导演：</span>
                        <span>{videoDetail.vod_director}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {(videoDetail.vod_blurb || videoDetail.vod_content) && (
                <div className="video-description">
                  <FileText className="w-4 h-4" />
                  <p>{videoDetail.vod_blurb || videoDetail.vod_content}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="error-container">
            <p className="error-text">未找到视频信息</p>
          </div>
        )}
      </div>
    </div>
  )
}
