import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { 
  Settings,
  PlayCircle,
  Info,
  Plus,
  X,
  Edit,
  Trash2,
  Timer,
  RefreshCw,
  Film,
  Search,
  History,
  Menu,
  ArrowUp,
  ArrowLeft
} from 'lucide-react'
import './App.css'
import './SettingsPage.css'
import './styles/player-page.css'
import './styles/player.css'
import './styles/login-modal.css'
import ParticleBackground from './components/ParticleBackground'
import VideoCover from './components/VideoCover'
import Player from './components/Player'
import LoadingProgress from './components/LoadingProgress'
import { LoginModal } from './components/LoginModal'
import { PlayHistory } from './utils/playHistory'
import { PlayHistoryManager } from './utils/playHistoryManager'
import type { PlayHistoryItem } from './utils/playHistoryManager'
import { isAuthenticated, getCurrentUsername } from './lib/auth'
import { isLoginRequired, getStorageType, isUsingDatabase } from './lib/api/login'
import { db } from './lib/db'

interface VideoSource {
  id: number
  name: string
  key: string
  apiUrl: string
  latency?: number | null
  testing?: boolean
}

interface VideoCategory {
  type_id: number
  type_pid: number
  type_name: string
}

interface VideoItem {
  vod_id: number
  vod_name: string
  type_id: number
  type_name: string
  vod_en: string
  vod_time: string
  vod_remarks: string
  vod_play_from: string
  vod_pic?: string
}

function App() {
  // ==================== 登录状态管理 ====================
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  
  // 检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      const loginRequired = isLoginRequired()
      const authenticated = isAuthenticated()
      
      if (!loginRequired) {
        // 不需要登录，直接进入
        setIsLoggedIn(true)
        setCurrentUser(getCurrentUsername())
        setIsCheckingAuth(false)
      } else if (authenticated) {
        // 已登录
        setIsLoggedIn(true)
        setCurrentUser(getCurrentUsername())
        setIsCheckingAuth(false)
      } else {
        // 需要登录但未登录
        setIsLoggedIn(false)
        setShowLoginModal(true)
        setIsCheckingAuth(false)
      }
    }
    
    checkAuth()
  }, [])
  
  // 登录成功回调
  const handleLoginSuccess = (username: string) => {
    setIsLoggedIn(true)
    setCurrentUser(username)
    setShowLoginModal(false)
  }
  
  // 获取当前用户名（用于数据库操作）
  const userName = currentUser || 'default'
  
  const [activeSection, setActiveSection] = useState(() => {
    const saved = localStorage.getItem('activeSection')
    return saved || 'home'
  })
  
  const [activeSettingsTab, setActiveSettingsTab] = useState(() => {
    const saved = localStorage.getItem('activeSettingsTab')
    return saved || 'video-config'
  })

  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false)
  const [isEditSourceModalOpen, setIsEditSourceModalOpen] = useState(false)
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null)
  const [newSource, setNewSource] = useState({
    name: '',
    key: '',
    apiUrl: ''
  })
  const [sources, setSources] = useState<VideoSource[]>([])
  const [testingSources, setTestingSources] = useState<Set<number>>(new Set())
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedSourceId')
    return saved ? parseInt(saved) : null
  })
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const fetchingSourceRef = useRef<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [proxySettings, setProxySettings] = useState<{
    enabled: boolean
    url: string
  }>(() => {
    const saved = localStorage.getItem('proxySettings')
    return saved ? JSON.parse(saved) : { enabled: false, url: '' }
  })
  
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [coverRatio, setCoverRatio] = useState<'3:4' | '16:9'>(() => {
    const saved = localStorage.getItem('coverRatio')
    return (saved === '16:9' || saved === '3:4') ? saved : '3:4'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(VideoItem & { sourceName?: string })[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  
  // 加载搜索历史（支持数据库和本地存储）
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        if (isUsingDatabase()) {
          const history = await db.getSearchHistory(userName)
          setSearchHistory(history)
        } else {
          const saved = localStorage.getItem('searchHistory')
          setSearchHistory(saved ? JSON.parse(saved) : [])
        }
      } catch (error) {
        console.error('加载搜索历史失败:', error)
        const saved = localStorage.getItem('searchHistory')
        setSearchHistory(saved ? JSON.parse(saved) : [])
      }
    }
    
    if (isLoggedIn) {
      loadSearchHistory()
    }
  }, [isLoggedIn, userName])
  
  const [playHistory, setPlayHistory] = useState<PlayHistoryItem[]>([])
  
  // 加载播放历史（支持数据库和本地存储）
  useEffect(() => {
    const loadPlayHistory = async () => {
      try {
        const history = await PlayHistoryManager.getAll(userName)
        setPlayHistory(history)
      } catch (error) {
        console.error('加载播放历史失败:', error)
        setPlayHistory(PlayHistory.getAll())
      }
    }
    
    if (isLoggedIn) {
      loadPlayHistory()
    }
  }, [isLoggedIn, userName])
  
  const [isHistoryPageOpen, setIsHistoryPageOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  
  const [playingVideo, setPlayingVideo] = useState<{
    sourceId: number | null
    videoId: string | null
    videoName?: string
    coverPic?: string
  } | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const sourceId = params.get('sourceId')
    const videoId = params.get('videoId')
    const videoName = params.get('videoName')
    const coverPic = params.get('coverPic')
    if (sourceId && videoId) {
      return {
        sourceId: parseInt(sourceId),
        videoId,
        videoName: videoName || undefined,
        coverPic: coverPic || undefined
      }
    }
    return null
  })

  useEffect(() => {
    localStorage.setItem('activeSection', activeSection)
  }, [activeSection])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sourceId = params.get('sourceId')
    const videoId = params.get('videoId')
    if (sourceId && videoId) {
      setActiveSection('videos')
    }
  }, [])

  useEffect(() => {
    if (playingVideo) {
      const params = new URLSearchParams()
      params.set('sourceId', playingVideo.sourceId?.toString() || '')
      params.set('videoId', playingVideo.videoId || '')
      if (playingVideo.videoName) params.set('videoName', playingVideo.videoName)
      if (playingVideo.coverPic) params.set('coverPic', playingVideo.coverPic)
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    } else {
      window.history.pushState({}, '', window.location.pathname)
    }
  }, [playingVideo])

  useEffect(() => {
    localStorage.setItem('activeSettingsTab', activeSettingsTab)
  }, [activeSettingsTab])

  // 加载视频源配置（支持数据库和本地存储）
  useEffect(() => {
    const loadSources = async () => {
      try {
        if (isUsingDatabase()) {
          // 从数据库加载
          const savedSources = await db.getVideoSources(userName)
          setSources(savedSources)
          const savedSelectedId = localStorage.getItem('selectedSourceId')
          if (savedSelectedId) {
            setSelectedSourceId(parseInt(savedSelectedId))
          } else if (savedSources.length > 0) {
            setSelectedSourceId(savedSources[0].id)
          }
        } else {
          // 从本地存储加载
          const savedSources = JSON.parse(localStorage.getItem('videoSources') || '[]')
          setSources(savedSources)
          const savedSelectedId = localStorage.getItem('selectedSourceId')
          if (savedSelectedId) {
            setSelectedSourceId(parseInt(savedSelectedId))
          } else if (savedSources.length > 0) {
            setSelectedSourceId(savedSources[0].id)
          }
        }
      } catch (error) {
        console.error('加载视频源配置失败:', error)
        // 降级到本地存储
        const savedSources = JSON.parse(localStorage.getItem('videoSources') || '[]')
        setSources(savedSources)
      }
    }
    
    if (isLoggedIn) {
      loadSources()
    }
  }, [isLoggedIn, userName])

  useEffect(() => {
    if (selectedSourceId !== null) {
      localStorage.setItem('selectedSourceId', selectedSourceId.toString())
    }
  }, [selectedSourceId])

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedSourceId !== null && sources.length > 0 && fetchingSourceRef.current !== selectedSourceId) {
      const source = sources.find(s => s.id === selectedSourceId)
      if (source) {
        fetchingSourceRef.current = selectedSourceId
        setCategories([])
        setVideos([])
        setSelectedCategoryId(null)
        fetchCategories(source.apiUrl)
      }
    }
  }, [selectedSourceId, sources])

  useEffect(() => {
    localStorage.setItem('proxySettings', JSON.stringify(proxySettings))
  }, [proxySettings])

  useEffect(() => {
    localStorage.setItem('coverRatio', coverRatio)
  }, [coverRatio])

  useEffect(() => {
    if (selectedCategoryId !== null && selectedSourceId !== null) {
      const source = sources.find(s => s.id === selectedSourceId)
      if (source) {
        setCurrentPage(1)
        setTotalPages(1)
        setHasMore(true)
        fetchVideos(source.apiUrl, selectedCategoryId, 1, false)
      }
    }
  }, [selectedCategoryId])

  const buildProxyUrl = useCallback((apiUrl: string, params?: Record<string, string>) => {
    if (proxySettings.enabled && proxySettings.url) {
      const proxyBase = proxySettings.url.replace(/\/$/, '')
      let fullUrl = `${proxyBase}/p/source1?url=${encodeURIComponent(apiUrl)}`
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          fullUrl += `&${key}=${encodeURIComponent(value)}`
        })
      }
      return fullUrl
    }
    
    const isProxyService = apiUrl.includes('url=')
    
    if (isProxyService) {
      let fullUrl = apiUrl
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          const separator = fullUrl.includes('?') ? '&' : '?'
          fullUrl = `${fullUrl}${separator}${key}=${encodeURIComponent(value)}`
        })
      }
      return fullUrl
    }
    
    let fullUrl = apiUrl
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, value)
      })
      const separator = apiUrl.includes('?') ? '&' : '?'
      fullUrl = `${apiUrl}${separator}${searchParams.toString()}`
    }
    
    return `/proxy?url=${encodeURIComponent(fullUrl)}`
  }, [proxySettings.enabled, proxySettings.url])

  const playerSources = useMemo(() => sources.map(s => ({
    id: s.id?.toString() || '',
    name: s.name,
    key: s.key,
    apiUrl: s.apiUrl,
    enabled: true,
    type: 'normal' as const
  })), [sources])

  const playerProxySettings = useMemo(() => proxySettings, [proxySettings.enabled, proxySettings.url])

  const fetchCategories = async (apiUrl: string) => {
    setIsLoadingCategories(true)
    try {
      const params: Record<string, string> = { ac: 'list' }
      const proxyUrl = buildProxyUrl(apiUrl, params)
      console.log('Fetching categories from:', proxyUrl)
      const response = await fetch(proxyUrl, {
        method: 'GET',
      })
      const data = await response.json()
      console.log('Categories response:', data)
      
      let categories: any[] = []
      
      if (data.code === 1) {
        if (data.class && Array.isArray(data.class)) {
          categories = data.class
        } else if (data.list && Array.isArray(data.list)) {
          categories = data.list
        } else if (data.ty && Array.isArray(data.ty)) {
          categories = data.ty
        } else if (data.types && Array.isArray(data.types)) {
          categories = data.types
        }
      }
      
      if (categories.length > 0) {
        setCategories(categories)
        setSelectedCategoryId(categories[0].type_id)
      } else {
        console.warn('No categories found in response:', data)
        setCategories([])
      }
    } catch (error) {
      console.error('获取分类失败:', error)
      if (proxySettings.enabled) {
        console.log('代理失败，尝试使用 Vite 开发代理...')
        try {
          const params: Record<string, string> = { ac: 'list' }
          const searchParams = new URLSearchParams()
          Object.entries(params).forEach(([key, value]) => {
            searchParams.set(key, value)
          })
          const separator = apiUrl.includes('?') ? '&' : '?'
          const fullUrl = `${apiUrl}${separator}${searchParams.toString()}`
          const viteProxyUrl = `/proxy?url=${encodeURIComponent(fullUrl)}`
          console.log('Fetching categories via Vite proxy:', viteProxyUrl)
          
          const response = await fetch(viteProxyUrl, {
            method: 'GET',
          })
          const data = await response.json()
          console.log('Categories Vite proxy response:', data)
          
          let categories: any[] = []
          
          if (data.code === 1) {
            if (data.class && Array.isArray(data.class)) {
              categories = data.class
            } else if (data.list && Array.isArray(data.list)) {
              categories = data.list
            } else if (data.ty && Array.isArray(data.ty)) {
              categories = data.ty
            } else if (data.types && Array.isArray(data.types)) {
              categories = data.types
            }
          }
          
          if (categories.length > 0) {
            setCategories(categories)
            setSelectedCategoryId(categories[0].type_id)
          } else {
            console.warn('No categories found in Vite proxy response:', data)
            setCategories([])
          }
        } catch (viteProxyError) {
          console.error('Vite 代理也失败:', viteProxyError)
          setCategories([])
        }
      } else {
        setCategories([])
      }
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const fetchVideos = async (apiUrl: string, typeId?: number, page: number = 1, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoadingVideos(true)
    }
    try {
      const params: Record<string, string> = { ac: 'detail', pg: page.toString() }
      if (typeId) {
        params.t = typeId.toString()
      }
      const proxyUrl = buildProxyUrl(apiUrl, params)
      console.log('Fetching videos from:', proxyUrl)
      const response = await fetch(proxyUrl, {
        method: 'GET',
      })
      const data = await response.json()
      console.log('Videos response:', data)
      
      const list = data.list || []
      
      if (list.length > 0) {
        if (append) {
          setVideos(prev => [...prev, ...list])
        } else {
          setVideos(list)
        }
        
        const pageCount = parseInt(data.pagecount) || parseInt(data.totalpage) || parseInt(data.pages) || 1
        const total = parseInt(data.total) || 0
        const limit = parseInt(data.limit) || 20
        
        if (pageCount > 1) {
          setTotalPages(pageCount)
          setHasMore(page < pageCount)
        } else if (total > 0 && limit > 0) {
          const calculatedPages = Math.ceil(total / limit)
          setTotalPages(calculatedPages)
          setHasMore(page < calculatedPages)
        } else {
          setHasMore(list.length >= limit)
          setTotalPages(list.length >= limit ? 999 : page)
        }
        setCurrentPage(parseInt(data.page) || page)
      } else {
        if (!append) {
          setVideos([])
        }
        setHasMore(false)
      }
    } catch (error) {
      console.error('获取视频列表失败:', error)
      if (proxySettings.enabled) {
        console.log('代理失败，尝试使用 Vite 开发代理...')
        try {
          const params: Record<string, string> = { ac: 'detail', pg: page.toString() }
          if (typeId) {
            params.t = typeId.toString()
          }
          const searchParams = new URLSearchParams()
          Object.entries(params).forEach(([key, value]) => {
            searchParams.set(key, value)
          })
          const separator = apiUrl.includes('?') ? '&' : '?'
          const fullUrl = `${apiUrl}${separator}${searchParams.toString()}`
          const viteProxyUrl = `/proxy?url=${encodeURIComponent(fullUrl)}`
          console.log('Fetching videos via Vite proxy:', viteProxyUrl)
          
          const response = await fetch(viteProxyUrl, {
            method: 'GET',
          })
          const data = await response.json()
          console.log('Videos Vite proxy response:', data)
          
          const list = data.list || []
          
          if (list.length > 0) {
            if (append) {
              setVideos(prev => [...prev, ...list])
            } else {
              setVideos(list)
            }
            
            const pageCount = parseInt(data.pagecount) || parseInt(data.totalpage) || parseInt(data.pages) || 1
            const total = parseInt(data.total) || 0
            const limit = parseInt(data.limit) || 20
            
            if (pageCount > 1) {
              setTotalPages(pageCount)
              setHasMore(page < pageCount)
            } else if (total > 0 && limit > 0) {
              const calculatedPages = Math.ceil(total / limit)
              setTotalPages(calculatedPages)
              setHasMore(page < calculatedPages)
            } else {
              setHasMore(list.length >= limit)
              setTotalPages(list.length >= limit ? 999 : page)
            }
            setCurrentPage(parseInt(data.page) || page)
          } else {
            if (!append) {
              setVideos([])
            }
            setHasMore(false)
          }
        } catch (viteProxyError) {
          console.error('Vite 代理也失败:', viteProxyError)
          if (!append) {
            setVideos([])
          }
          setHasMore(false)
        }
      } else {
        if (!append) {
          setVideos([])
        }
        setHasMore(false)
      }
    } finally {
      setIsLoadingVideos(false)
      setIsLoadingMore(false)
    }
  }

  const loadMoreVideos = async () => {
    if (isLoadingMore || !hasMore) return
    
    const source = sources.find(s => s.id === selectedSourceId)
    if (source) {
      await fetchVideos(source.apiUrl, selectedCategoryId || undefined, currentPage + 1, true)
    }
  }

  const handleSearch = async (query: string, sourceIndex: number = 0) => {
    if (!query.trim()) return
    
    // 保存搜索历史
    const trimmedQuery = query.trim()
    const newHistory = [trimmedQuery, ...searchHistory.filter(h => h !== trimmedQuery)].slice(0, 10)
    setSearchHistory(newHistory)
    saveSearchHistory(newHistory)
    
    setIsSearching(true)
    setSearchResults([])
    
    try {
      const allResults: (VideoItem & { sourceName?: string })[] = []
      
      for (let i = sourceIndex; i < sources.length; i++) {
        const source = sources[i]
        try {
          const params: Record<string, string> = { 
            ac: 'detail', 
            wd: query.trim()
          }
          const proxyUrl = buildProxyUrl(source.apiUrl, params)
          const response = await fetch(proxyUrl, {
            method: 'GET',
          })
          const data = await response.json()
          
          const list = data.list || []
          if (list.length > 0) {
            list.forEach((item: VideoItem) => {
              allResults.push({
                ...item,
                vod_pic: item.vod_pic?.replace(/\\/g, ''),
                sourceName: source.name
              })
            })
          }
        } catch (error) {
          console.error(`搜索源 ${source.name} 失败:`, error)
        }
      }
      
      setSearchResults(allResults)
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const deletePlayHistoryItem = async (index: number) => {
    const item = playHistory[index]
    if (item) {
      await PlayHistoryManager.remove(userName, item.id)
      const newHistory = playHistory.filter((_, i) => i !== index)
      setPlayHistory(newHistory)
    }
  }

  const clearPlayHistory = async () => {
    await PlayHistoryManager.clear(userName)
    setPlayHistory([])
  }

  const testLatency = async (apiUrl: string): Promise<number> => {
    const startTime = performance.now()
    try {
      const testUrl = buildProxyUrl(apiUrl)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      try {
        await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal
        })
        clearTimeout(timeoutId)
        const endTime = performance.now()
        return Math.round(endTime - startTime)
      } catch (corsError) {
        clearTimeout(timeoutId)
        const controller2 = new AbortController()
        const timeoutId2 = setTimeout(() => controller2.abort(), 15000)
        
        await fetch(testUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller2.signal
        })
        
        clearTimeout(timeoutId2)
        const endTime = performance.now()
        return Math.round(endTime - startTime)
      }
    } catch (error) {
      return -1
    }
  }

  const handleTestLatency = async (sourceId: number) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    setTestingSources(prev => new Set(prev).add(sourceId))
    
    const latency = await testLatency(source.apiUrl)
    
    setSources(prev => {
      const updatedSources = prev.map(s => 
        s.id === sourceId ? { ...s, latency } : s
      )
      saveVideoSources(updatedSources)
      return updatedSources
    })
    
    setTestingSources(prev => {
      const newSet = new Set(prev)
      newSet.delete(sourceId)
      return newSet
    })
  }

  const handleAddSource = () => {
    const newId = Date.now()
    const newSourceWithId: VideoSource = {
      ...newSource,
      id: newId,
      latency: null
    }
    const updatedSources = [...sources, newSourceWithId]
    setSources(updatedSources)
    saveVideoSources(updatedSources)
    setNewSource({ name: '', key: '', apiUrl: '' })
    setIsAddSourceModalOpen(false)
    
    testLatency(newSource.apiUrl).then(latency => {
      setSources(prev => {
        const finalSources = prev.map(s => 
          s.id === newId ? { ...s, latency } : s
        )
        saveVideoSources(finalSources)
        return finalSources
      })
    })
  }

  const handleDeleteSource = (id: number) => {
    const updatedSources = sources.filter(source => source.id !== id)
    setSources(updatedSources)
    saveVideoSources(updatedSources)
  }

  const handleEditSource = (source: VideoSource) => {
    setEditingSourceId(source.id)
    setNewSource({
      name: source.name,
      key: source.key,
      apiUrl: source.apiUrl
    })
    setIsEditSourceModalOpen(true)
  }

  const handleUpdateSource = () => {
    const currentEditingId = editingSourceId
    const currentApiUrl = newSource.apiUrl
    
    setSources(prev => {
      const updatedSources = prev.map(source => 
        source.id === currentEditingId 
          ? { ...newSource, id: currentEditingId, latency: null }
          : source
      )
      saveVideoSources(updatedSources)
      return updatedSources
    })
    
    setNewSource({ name: '', key: '', apiUrl: '' })
    setEditingSourceId(null)
    setIsEditSourceModalOpen(false)
    
    testLatency(currentApiUrl).then(latency => {
      setSources(prev => {
        const finalSources = prev.map(s => 
          s.id === currentEditingId ? { ...s, latency } : s
        )
        saveVideoSources(finalSources)
        return finalSources
      })
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewSource(prev => ({ ...prev, [name]: value }))
  }

  // 保存视频源配置（支持数据库和本地存储）
  const saveVideoSources = async (updatedSources: VideoSource[]) => {
    try {
      if (isUsingDatabase()) {
        // 保存到数据库
        await db.setVideoSources(userName, updatedSources)
      } else {
        // 保存到本地存储
        localStorage.setItem('videoSources', JSON.stringify(updatedSources))
      }
    } catch (error) {
      console.error('保存视频源配置失败:', error)
      // 降级到本地存储
      localStorage.setItem('videoSources', JSON.stringify(updatedSources))
    }
  }

  // 保存搜索历史（支持数据库和本地存储）
  const saveSearchHistory = async (newHistory: string[]) => {
    try {
      if (isUsingDatabase()) {
        // 保存到数据库
        await db.deleteSearchHistory(userName)
        for (const keyword of newHistory) {
          await db.addSearchHistory(userName, keyword)
        }
      } else {
        // 保存到本地存储
        localStorage.setItem('searchHistory', JSON.stringify(newHistory))
      }
    } catch (error) {
      console.error('保存搜索历史失败:', error)
      // 降级到本地存储
      localStorage.setItem('searchHistory', JSON.stringify(newHistory))
    }
  }

  const getLatencyColor = (latency: number | null | undefined): string => {
    if (latency === null || latency === undefined || latency < 0) return '#ef4444'
    if (latency < 300) return '#22c55e'
    if (latency <= 1000) return '#eab308'
    return '#ef4444'
  }

  const getLatencyText = (latency: number | null | undefined): string => {
    if (latency === null || latency === undefined) return '未测试'
    if (latency < 0) return '超时'
    return `${latency}ms`
  }

  // 正在检查认证状态
  if (isCheckingAuth) {
    return (
      <div className="app">
        <ParticleBackground />
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  // 未登录时显示登录弹窗
  if (!isLoggedIn) {
    return (
      <div className="app">
        <ParticleBackground />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => {}}
          onLoginSuccess={handleLoginSuccess}
          storageType={getStorageType()}
        />
      </div>
    )
  }

  return (
    <div className="app">
      {/* 粒子背景 */}
      <ParticleBackground />
      
      {/* 登录弹窗 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
        storageType={getStorageType()}
      />
      
      {/* 悬浮胶囊导航栏（移植自LongTV-main） */}
      <nav className="navbar">
        <div className="navbar-container">
          {/* 左侧按钮区域 */}
          <div className="navbar-left">
            <button 
              className="navbar-btn navbar-btn-video" 
              onClick={() => setActiveSection('videos')} 
              title="视频"
            >
              <Film className="navbar-icon" />
            </button>
          </div>

          {/* 分隔线 */}
          <div className="navbar-divider"></div>

          {/* Logo区域 */}
          <div className="navbar-logo" onClick={() => setActiveSection('home')}>
            <span className="navbar-logo-text">
              Long<span className="navbar-logo-tv">TV</span>
            </span>
          </div>

          {/* 分隔线 */}
          <div className="navbar-divider"></div>

          {/* 右侧按钮区域 */}
          <div className="navbar-right">
            <button 
              className="navbar-btn navbar-btn-search" 
              onClick={() => setIsSearchModalOpen(true)}
              title="搜索"
            >
              <Search className="navbar-icon" />
            </button>
            <button 
              className="navbar-btn navbar-btn-history" 
              onClick={async () => {
                // 打开历史记录弹窗前重新加载
                try {
                  const history = await PlayHistoryManager.getAll(userName)
                  setPlayHistory(history)
                } catch (error) {
                  console.error('加载播放历史失败:', error)
                }
                setIsHistoryPageOpen(true)
              }}
              title="观看历史"
            >
              <History className="navbar-icon" />
            </button>
            <button 
              className="navbar-btn navbar-btn-settings" 
              onClick={() => setActiveSection('settings')}
              title="设置"
            >
              <Settings className="navbar-icon" />
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      {activeSection === 'home' && !playingVideo && (
        <section id="home" className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              欢迎来到 <span className="highlight">LongTV</span>
            </h1>
          </div>
        </section>
      )}

      {/* 视频页面 */}
      {activeSection === 'videos' && !playingVideo && (
        <section id="videos" className="videos-page">
          <div className="container">
            <div className="page-header">
              <h1 className="videos-title">视频</h1>
              <button onClick={() => setActiveSection('home')} className="back-button">
                <ArrowLeft className="w-5 h-5" />
                返回
              </button>
            </div>
            
            {/* 视频源选择器 */}
            {sources.length > 0 && (
              <div className="source-selector">
                <div className="source-tabs-container">
                  <div className="source-tabs">
                    {sources.slice(0, 4).map(source => (
                      <button
                        key={source.id}
                        className={`source-tab ${(selectedSourceId || sources[0]?.id) === source.id ? 'active' : ''}`}
                        onClick={() => setSelectedSourceId(source.id)}
                      >
                        {source.name}
                      </button>
                    ))}
                  </div>
                  {sources.length > 4 && (
                    <button
                      className="source-more-btn"
                      onClick={() => setIsSourceModalOpen(true)}
                      title="查看更多视频源"
                    >
                      <Menu size={20} />
                    </button>
                  )}
                </div>
                <button 
                  className="cover-ratio-toggle"
                  onClick={() => setCoverRatio(coverRatio === '3:4' ? '16:9' : '3:4')}
                  title={`切换封面比例（当前：${coverRatio}）`}
                >
                  <span>{coverRatio}</span>
                </button>
              </div>
            )}

            {/* 视频内容区域 */}
            <div className="videos-content">
              {sources.length === 0 ? (
                <div className="no-sources-message">
                  <p>暂无视频源，请先在设置页面添加视频源</p>
                  <button className="go-settings-btn" onClick={() => setActiveSection('settings')}>
                    前往设置
                  </button>
                </div>
              ) : (
                <div>
                  {/* 分类标签 */}
                  {isLoadingCategories ? (
                    <LoadingProgress text="加载分类中" />
                  ) : categories.length > 0 && (
                    <>
                      <div className="category-tabs">
                        {categories.slice(0, 12).map(category => (
                          <button
                            key={category.type_id}
                            className={`category-tab ${selectedCategoryId === category.type_id ? 'active' : ''}`}
                            onClick={() => setSelectedCategoryId(category.type_id)}
                          >
                            {category.type_name}
                          </button>
                        ))}
                      </div>
                      {categories.length > 12 && (
                        <button
                          className="category-more-btn-standalone"
                          onClick={() => setIsCategoryModalOpen(true)}
                          title="查看更多分类"
                        >
                          <Menu size={20} />
                        </button>
                      )}
                    </>
                  )}

                  {/* 视频列表 */}
                  {isLoadingVideos ? (
                    <LoadingProgress text="加载视频中" />
                  ) : videos.length > 0 ? (
                    <div>
                      <div className={`video-grid ratio-${coverRatio.replace(':', '-')}`}>
                        {videos.map(video => (
                          <div 
                            key={video.vod_id} 
                            className="video-card"
                            onClick={() => {
                              const sourceId = selectedSourceId || sources[0]?.id || null
                              console.log('Video clicked:', { 
                                selectedSourceId, 
                                sourceId,
                                videoId: video.vod_id, 
                                videoName: video.vod_name 
                              })
                              if (sourceId !== null) {
                                setPlayingVideo({
                                  sourceId: typeof sourceId === 'number' ? sourceId : parseInt(sourceId),
                                  videoId: video.vod_id.toString(),
                                  videoName: video.vod_name,
                                  coverPic: video.vod_pic
                                })
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <VideoCover src={video.vod_pic} alt={video.vod_name} ratio={coverRatio} />
                            <div className="video-info">
                              <h4 className="video-name">{video.vod_name}</h4>
                              <p className="video-remarks">{video.vod_remarks}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* 分页控制 */}
                      {hasMore && (
                        <div className="pagination">
                          {totalPages < 999 && (
                            <span className="page-info">
                              第 {currentPage} / {totalPages} 页
                            </span>
                          )}
                          <button 
                            className="load-more-btn"
                            onClick={loadMoreVideos}
                            disabled={isLoadingMore}
                          >
                            {isLoadingMore ? '加载中...' : '加载更多'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : categories.length > 0 && (
                    <div className="no-videos-message">暂无视频</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 播放器页面 */}
      {playingVideo ? (
        <Player
          sourceId={playingVideo.sourceId?.toString() || null}
          videoId={playingVideo.videoId}
          videoName={playingVideo.videoName}
          coverPic={playingVideo.coverPic}
          sources={playerSources}
          proxySettings={playerProxySettings}
          buildProxyUrl={buildProxyUrl}
          userName={userName}
          onBack={async () => {
            setPlayingVideo(null)
            // 重新加载播放历史
            try {
              const history = await PlayHistoryManager.getAll(userName)
              setPlayHistory(history)
            } catch (error) {
              console.error('重新加载播放历史失败:', error)
            }
          }}
        />
      ) : (
        <div>
          {/* 设置页面 */}
          {activeSection === 'settings' && (
            <section id="settings" className="settings-page">
              <div className="container">
                <div className="page-header">
                  <h1 className="settings-title">设置页面</h1>
                  <button onClick={() => setActiveSection('home')} className="back-button">
                    <ArrowLeft className="w-5 h-5" />
                    返回
                  </button>
                </div>
            
            {/* 设置页面胶囊导航 */}
            <nav className="settings-navbar">
              <div className="settings-nav-container">
                <div 
                  className="settings-nav-bg" 
                  style={{ 
                    transform: activeSettingsTab === 'about' ? 'translateX(100%)' : 'translateX(0)',
                    width: '50%'
                  }}
                ></div>
                <button className={`settings-nav-btn ${activeSettingsTab === 'video-config' ? 'active' : ''}`} onClick={() => setActiveSettingsTab('video-config')}>
                  <PlayCircle className="settings-nav-icon" />
                  <span>视频源配置</span>
                </button>
                <button className={`settings-nav-btn ${activeSettingsTab === 'about' ? 'active' : ''}`} onClick={() => setActiveSettingsTab('about')}>
                  <Info className="settings-nav-icon" />
                  <span>关于</span>
                </button>
              </div>
            </nav>

            {/* 设置内容 */}
            <div className="settings-content">
              {activeSettingsTab === 'video-config' && (
                <div className="video-config">
                  <div className="video-config-header">
                    <h2>视频源配置</h2>
                    <button className="add-source-btn" onClick={() => setIsAddSourceModalOpen(true)}>
                      <Plus className="add-source-icon" />
                      <span>添加源</span>
                    </button>
                  </div>

                  {/* 代理加速设置 */}
                  <div className="proxy-settings-card">
                    <div className="proxy-settings-header">
                      <h3>代理加速</h3>
                      <label className="proxy-toggle">
                        <input 
                          type="checkbox" 
                          checked={proxySettings.enabled} 
                          onChange={(e) => setProxySettings({ ...proxySettings, enabled: e.target.checked })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                    <div className="proxy-settings-content">
                      <input 
                        type="text" 
                        className="proxy-url-input"
                        placeholder="输入代理加速地址，如：https://a.chenxicf.de5.net"
                        value={proxySettings.url}
                        onChange={(e) => setProxySettings({ ...proxySettings, url: e.target.value })}
                        disabled={!proxySettings.enabled}
                      />
                      <p className="proxy-hint">开启后，所有API请求将通过代理加速服务转发</p>
                    </div>
                  </div>

                  <div className="sources-list">
                    {sources.length === 0 ? (
                      <p className="no-sources">暂无视频源，点击"添加源"按钮添加</p>
                    ) : (
                      sources.map((source) => (
                        <div key={source.id} className="source-card">
                          <div className="source-info">
                            <h4>{source.name}</h4>
                            <p><span className="label">Key:</span> {source.key}</p>
                            <div className="api-row">
                              <p className="api-url"><span className="label">API:</span> {source.apiUrl}</p>
                            </div>
                            <div 
                              className="latency-display" 
                              style={{ color: getLatencyColor(source.latency) }}
                            >
                              <Timer className="latency-icon" size={14} />
                              <span>{getLatencyText(source.latency)}</span>
                            </div>
                            <div className="source-actions">
                              <button 
                                className="source-action-btn test-btn" 
                                onClick={() => handleTestLatency(source.id)}
                                disabled={testingSources.has(source.id)}
                                title="测试延迟"
                              >
                                <RefreshCw className={`source-action-icon ${testingSources.has(source.id) ? 'spinning' : ''}`} />
                              </button>
                              <button className="source-action-btn edit-btn" onClick={() => handleEditSource(source)}>
                                <Edit className="source-action-icon" />
                              </button>
                              <button className="source-action-btn delete-btn" onClick={() => handleDeleteSource(source.id)}>
                                <Trash2 className="source-action-icon" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              
              {activeSettingsTab === 'about' && (
                <div className="about-section">
                  <h2>关于</h2>
                  <p>这是LongTV的设置页面</p>
                </div>
              )}
            </div>

            {/* 添加源弹窗 */}
            {isAddSourceModalOpen && (
              <div className="modal-overlay" onClick={() => setIsAddSourceModalOpen(false)}>
                <div 
                  className="modal-content" 
                  onClick={e => e.stopPropagation()}
                  onWheel={e => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>添加视频源</h3>
                    <button className="modal-close-btn" onClick={() => setIsAddSourceModalOpen(false)}>
                      <X className="modal-close-icon" />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>名称</label>
                      <input 
                        type="text" 
                        name="name"
                        value={newSource.name}
                        onChange={handleInputChange}
                        placeholder="请输入源名称"
                      />
                    </div>
                    <div className="form-group">
                      <label>Key</label>
                      <input 
                        type="text" 
                        name="key"
                        value={newSource.key}
                        onChange={handleInputChange}
                        placeholder="请输入Key"
                      />
                    </div>
                    <div className="form-group">
                      <label>视频API地址</label>
                      <input 
                        type="text" 
                        name="apiUrl"
                        value={newSource.apiUrl}
                        onChange={handleInputChange}
                        placeholder="请输入视频API地址"
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={() => setIsAddSourceModalOpen(false)}>取消</button>
                    <button className="modal-save-btn" onClick={handleAddSource}>保存</button>
                  </div>
                </div>
              </div>
            )}

            {/* 编辑源弹窗 */}
            {isEditSourceModalOpen && (
              <div className="modal-overlay" onClick={() => setIsEditSourceModalOpen(false)}>
                <div 
                  className="modal-content" 
                  onClick={e => e.stopPropagation()}
                  onWheel={e => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>编辑视频源</h3>
                    <button className="modal-close-btn" onClick={() => setIsEditSourceModalOpen(false)}>
                      <X className="modal-close-icon" />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>名称</label>
                      <input 
                        type="text" 
                        name="name"
                        value={newSource.name}
                        onChange={handleInputChange}
                        placeholder="请输入源名称"
                      />
                    </div>
                    <div className="form-group">
                      <label>Key</label>
                      <input 
                        type="text" 
                        name="key"
                        value={newSource.key}
                        onChange={handleInputChange}
                        placeholder="请输入Key"
                      />
                    </div>
                    <div className="form-group">
                      <label>视频API地址</label>
                      <input 
                        type="text" 
                        name="apiUrl"
                        value={newSource.apiUrl}
                        onChange={handleInputChange}
                        placeholder="请输入视频API地址"
                      />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={() => setIsEditSourceModalOpen(false)}>取消</button>
                    <button className="modal-save-btn" onClick={handleUpdateSource}>保存</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )}

      {/* 搜索弹窗 */}
      {isSearchModalOpen && (
        <div className="modal-overlay search-modal-overlay" onClick={() => setIsSearchModalOpen(false)}>
          <div 
            className="modal-content search-modal-content" 
            onClick={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="search-modal-fixed">
              <div className="modal-header">
                <h3>搜索影片</h3>
                <button className="modal-close-btn" onClick={() => {
                  setIsSearchModalOpen(false)
                  setSearchQuery('')
                  setSearchResults([])
                }}>
                  <X className="modal-close-icon" />
                </button>
              </div>
              <div className="search-input-container">
                <div className="search-input-wrapper">
                  <input 
                    type="text" 
                    className="search-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSearch(searchQuery)
                      }
                    }}
                    placeholder="输入影片名称搜索..."
                    autoFocus
                  />
                  <button 
                    className="search-icon-btn"
                    onClick={() => handleSearch(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    title="搜索"
                  >
                    <Search className="search-icon" />
                  </button>
                </div>
              </div>
            </div>

            <div className="search-modal-scrollable">
              {/* 搜索历史 */}
              {!isSearching && searchHistory.length > 0 && searchResults.length === 0 && !searchQuery && (
                <div className="search-history">
                  <div className="search-history-header">
                    <span>搜索历史</span>
                    <button 
                      className="clear-history-btn"
                      onClick={() => {
                        setSearchHistory([])
                        saveSearchHistory([])
                      }}
                    >
                      清除
                    </button>
                  </div>
                  <div className="search-history-list">
                    {searchHistory.map((history, index) => (
                      <button
                        key={index}
                        className="search-history-item"
                        onClick={() => {
                          setSearchQuery(history)
                          handleSearch(history)
                        }}
                      >
                        <span>{history}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {isSearching && (
                <div className="search-loading">
                  <LoadingProgress text="正在搜索所有视频源" />
                </div>
              )}
              
              {!isSearching && searchResults.length > 0 && (
                <div className="search-results">
                  <div className="search-results-header">
                    找到 {searchResults.length} 个结果
                  </div>
                  <div className={`search-results-grid ratio-${coverRatio.replace(':', '-')}`}>
                    {searchResults.map(video => (
                      <div 
                        key={`${video.vod_id}-${video.type_id}`}
                        className="search-result-card"
                        onClick={() => {
                          const source = sources.find(s => s.apiUrl.includes(video.vod_play_from?.split(',')[0]) || true)
                          const sourceId = source?.id || sources[0]?.id || null
                          if (sourceId !== null) {
                            setPlayingVideo({
                              sourceId: typeof sourceId === 'number' ? sourceId : parseInt(sourceId),
                              videoId: video.vod_id.toString(),
                              videoName: video.vod_name,
                              coverPic: video.vod_pic
                            })
                            setIsSearchModalOpen(false)
                            setSearchQuery('')
                            setSearchResults([])
                          }
                        }}
                      >
                        <div className="search-result-cover">
                          <VideoCover src={video.vod_pic} alt={video.vod_name} ratio={coverRatio} />
                        </div>
                        <div className="search-result-info">
                          <h4 className="search-result-title">{video.vod_name}</h4>
                          <p className="search-result-meta">{video.type_name} · {video.vod_remarks || '未知'}</p>
                          <p className="search-result-source">来源: {video.sourceName || '未知'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="search-no-results">
                  未找到相关影片
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 历史记录弹窗 */}
      {isHistoryPageOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryPageOpen(false)}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>观看历史</h3>
              <button className="modal-close-btn" onClick={() => setIsHistoryPageOpen(false)}>
                <X className="modal-close-icon" />
              </button>
            </div>
            <div className="history-content">
              {playHistory.length === 0 ? (
                <div className="history-empty">
                  <p>暂无观看记录</p>
                </div>
              ) : (
                <>
                  <div className="history-header">
                    <span className="history-count">共 {playHistory.length} 条记录</span>
                    <button 
                      className="clear-history-btn"
                      onClick={clearPlayHistory}
                    >
                      清空全部
                    </button>
                  </div>
                  <div className="history-list">
                    {playHistory.map((item, index) => (
                      <div key={index} className="history-item">
                        <div 
                          className="history-item-content"
                          onClick={() => {
                            const source = sources.find(s => s.name === item.sourceName)
                            const sourceId = source?.id || sources[0]?.id || null
                            if (sourceId !== null) {
                              setPlayingVideo({
                                sourceId: typeof sourceId === 'number' ? sourceId : parseInt(sourceId),
                                videoId: item.searchTitle,
                                videoName: item.title,
                                coverPic: item.cover
                              })
                              setIsHistoryPageOpen(false)
                            }
                          }}
                        >
                          <div className="history-cover">
                            <VideoCover 
                              src={item.cover}
                              alt={item.title}
                              ratio={coverRatio}
                            />
                          </div>
                          <div className="history-info">
                            <h4 className="history-title">{item.title}</h4>
                            <p className="history-meta">
                              {item.sourceName} · 第 {item.index} 集 / 共 {item.totalEpisodes} 集
                            </p>
                            <p className="history-time">
                              {new Date(item.saveTime).toLocaleString('zh-CN')}
                            </p>
                          </div>
                        </div>
                        <button 
                          className="history-delete-btn"
                          onClick={() => deletePlayHistoryItem(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 分类弹窗 */}
      {isCategoryModalOpen && (
        <div className="modal-overlay category-modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
          <div 
            className="modal-content category-modal-content" 
            onClick={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>所有分类</h3>
              <button className="modal-close-btn" onClick={() => setIsCategoryModalOpen(false)}>
                <X className="modal-close-icon" />
              </button>
            </div>
            <div className="category-modal-grid">
              {categories.map(category => (
                <button
                  key={category.type_id}
                  className={`category-modal-item ${selectedCategoryId === category.type_id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategoryId(category.type_id)
                    setIsCategoryModalOpen(false)
                  }}
                >
                  {category.type_name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 视频源弹窗 */}
      {isSourceModalOpen && (
        <div className="modal-overlay category-modal-overlay" onClick={() => setIsSourceModalOpen(false)}>
          <div 
            className="modal-content category-modal-content" 
            onClick={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>所有视频源</h3>
              <button className="modal-close-btn" onClick={() => setIsSourceModalOpen(false)}>
                <X className="modal-close-icon" />
              </button>
            </div>
            <div className="category-modal-grid">
              {sources.map(source => (
                <button
                  key={source.id}
                  className={`category-modal-item ${(selectedSourceId || sources[0]?.id) === source.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSourceId(source.id)
                    setIsSourceModalOpen(false)
                  }}
                >
                  {source.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 页脚 */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2026 LongTV. 基于 React 19 + Vite 7 + TypeScript 构建</p>
        </div>
      </footer>

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <button 
          className="back-to-top-btn"
          onClick={scrollToTop}
          title="回到顶部"
        >
          <ArrowUp size={24} />
        </button>
      )}
    </div>
  )
}

export default App