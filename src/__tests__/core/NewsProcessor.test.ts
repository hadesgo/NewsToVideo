import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import NewsProcessor from '../../core/NewsProcessor.ts'
import { TestDataGenerator, MockUtils, TestAssertions } from '../utils/test-helpers.ts'

// Mock dependencies
const mockFs = MockUtils.mockFileSystem()
const mockLogger = MockUtils.mockLogger()

vi.mock('fs', () => mockFs)
vi.mock('../../lib/logger.ts', () => ({ default: mockLogger }))
vi.mock('../../lib/news.ts', () => ({
  default: vi.fn().mockResolvedValue(TestDataGenerator.generateMockNews(3)),
}))
vi.mock('../../lib/tts.ts', () => ({
  default: vi.fn().mockResolvedValue({
    audio: '/test/audio.mp3',
    subtitles: [],
  }),
}))
vi.mock('../../material/image.ts', () => ({
  default: vi.fn().mockResolvedValue('/test/image.png'),
}))
vi.mock('../../material/video.ts', () => ({
  default: vi.fn().mockResolvedValue('/test/video.mp4'),
}))
vi.mock('../../utils/ffmpeg.ts', () => ({
  getVideoDurationInSeconds: vi.fn().mockResolvedValue(30),
}))
vi.mock('../../utils/utils.ts', () => ({
  genTalkVideo: vi.fn().mockResolvedValue(undefined),
  saveConfig: vi.fn(),
}))
vi.mock('../../core/ErrorHandler.ts', () => ({
  default: {
    executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
    createContext: vi.fn().mockReturnValue({}),
  },
}))
vi.mock('../../config/index.ts', () => ({
  default: {
    getVideoConfig: () => ({ layouts: ['portrait'] }),
  },
}))

describe('NewsProcessor', () => {
  let processor: NewsProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock behaviors
    mockFs.existsSync.mockReturnValue(false)
    mockFs.mkdirSync.mockReturnValue(undefined)
    mockFs.readFileSync.mockReturnValue('[]')
    mockFs.writeFileSync.mockReturnValue(undefined)
    
    processor = new NewsProcessor()
  })

  afterEach(() => {
    TestDataGenerator.cleanupTempFiles()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with current date by default', () => {
      const processor = new NewsProcessor()
      
      expect(processor.getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(processor.getVideoName()).toContain('每日全球热点新闻资讯')
    })

    it('should initialize with custom date', () => {
      const customDate = new Date('2024-01-15')
      const processor = new NewsProcessor(customDate)
      
      expect(processor.getToday()).toBe('2024-01-15')
      expect(processor.getVideoName()).toContain('2024年01月15日')
    })

    it('should create output directory structure', () => {
      const outputDir = processor.getOutputDir()
      
      expect(outputDir).toContain('./out/')
      expect(outputDir).toContain(processor.getToday())
    })
  })

  describe('News List Processing', () => {
    it('should load existing news list from file', async () => {
      const existingNews = TestDataGenerator.generateMockNews(2)
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingNews))

      const newsList = await processor.getNewsList()

      expect(newsList).toEqual(existingNews)
      expect(mockFs.readFileSync).toHaveBeenCalled()
    })

    it('should fetch new news when file does not exist', async () => {
      const mockNews = TestDataGenerator.generateMockNews(3)
      mockFs.existsSync.mockReturnValue(false)
      
      const newsModule = await import('../../lib/news.ts')
      vi.mocked(newsModule.default).mockResolvedValue(mockNews)

      const newsList = await processor.getNewsList()

      expect(newsList).toEqual(mockNews)
      expect(mockFs.writeFileSync).toHaveBeenCalled()
    })

    it('should handle empty news response', async () => {
      mockFs.existsSync.mockReturnValue(false)
      
      const newsModule = await import('../../lib/news.ts')
      vi.mocked(newsModule.default).mockResolvedValue([])

      await TestAssertions.assertAsyncThrows(
        () => processor.getNewsList(),
        'No news data received'
      )
    })
  })

  describe('Audio Generation', () => {
    it('should generate audio for news item', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      mockFs.existsSync.mockReturnValue(false)

      const audioInfo = await processor.generateAudio(newsItem, 0)

      expect(audioInfo).toBeDefined()
      expect(audioInfo.path).toBeDefined()
      expect(audioInfo.duration).toBeGreaterThan(0)
    })

    it('should return existing audio if file exists', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      mockFs.existsSync.mockReturnValue(true)

      const audioInfo = await processor.generateAudio(newsItem, 0)

      expect(audioInfo).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Audio already exists')
      )
    })

    it('should handle progress callback', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      const progressCallback = vi.fn()
      mockFs.existsSync.mockReturnValue(false)

      await processor.generateAudio(newsItem, 0, progressCallback)

      expect(progressCallback).toHaveBeenCalledWith('Generating audio', 0, 1)
    })
  })

  describe('Material Generation', () => {
    it('should get video material when available', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      const videoModule = await import('../../material/video.ts')
      vi.mocked(videoModule.default).mockResolvedValue('/test/video.mp4')

      const material = await processor.getMaterial(newsItem, 'portrait', 30, 0)

      expect(material.type).toBe('video')
      expect(material.path).toBe('/test/video.mp4')
    })

    it('should fallback to image when video is not available', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      const videoModule = await import('../../material/video.ts')
      vi.mocked(videoModule.default).mockResolvedValue(null)
      mockFs.existsSync.mockReturnValue(false)

      const material = await processor.getMaterial(newsItem, 'portrait', 30, 0)

      expect(material.type).toBe('image')
    })

    it('should use existing image if available', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      const videoModule = await import('../../material/video.ts')
      vi.mocked(videoModule.default).mockResolvedValue(null)
      mockFs.existsSync.mockReturnValue(true)

      const material = await processor.getMaterial(newsItem, 'portrait', 30, 0)

      expect(material.type).toBe('image')
    })

    it('should handle different layouts', async () => {
      const newsItem = TestDataGenerator.generateMockNews(1)[0]
      
      // Test portrait layout
      await processor.getMaterial(newsItem, 'portrait', 30, 0)
      
      // Test landscape layout
      await processor.getMaterial(newsItem, 'landscape', 30, 0)

      // Should handle both layouts without errors
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  describe('Talk Video Generation', () => {
    it('should generate talk video', async () => {
      const audioPath = '/test/audio.mp3'
      mockFs.existsSync.mockReturnValue(false)

      const talkVideo = await processor.generateTalkVideo(audioPath, 0)

      expect(talkVideo.path).toBeDefined()
    })

    it('should return existing talk video if available', async () => {
      const audioPath = '/test/audio.mp3'
      mockFs.existsSync.mockReturnValue(true)

      const talkVideo = await processor.generateTalkVideo(audioPath, 0)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Talk video already exists')
      )
    })
  })

  describe('Complete News Processing', () => {
    it('should process all news for a layout', async () => {
      const mockNews = TestDataGenerator.generateMockNews(2)
      mockFs.existsSync.mockImplementation((path) => {
        // Simulate existing news file but no other files
        return path.toString().includes('news.json')
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockNews))

      const config = await processor.processNewsForLayout(mockNews, 'portrait')

      expect(config).toBeDefined()
      expect(config.layout).toBe('portrait')
      expect(config.layers).toHaveLength(2)
    })

    it('should process all news with progress callback', async () => {
      const mockNews = TestDataGenerator.generateMockNews(1)
      const progressCallback = vi.fn()
      mockFs.existsSync.mockImplementation((path) => {
        return path.toString().includes('news.json')
      })
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockNews))

      await processor.processNewsForLayout(mockNews, 'portrait', progressCallback)

      expect(progressCallback).toHaveBeenCalled()
    })

    it('should process all news for all layouts', async () => {
      const newsModule = await import('../../lib/news.ts')
      vi.mocked(newsModule.default).mockResolvedValue(TestDataGenerator.generateMockNews(2))
      
      const result = await processor.processAllNews()

      expect(result.newsList).toHaveLength(2)
      expect(result.configs.size).toBeGreaterThan(0)
    })

    it('should handle empty news list', async () => {
      const newsModule = await import('../../lib/news.ts')
      vi.mocked(newsModule.default).mockResolvedValue([])

      await TestAssertions.assertAsyncThrows(
        () => processor.processAllNews(),
        'No news items to process'
      )
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(processor.cleanup()).resolves.not.toThrow()
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'NewsProcessor cleanup completed'
      )
    })
  })

  describe('Utility Methods', () => {
    it('should provide output directory', () => {
      const outputDir = processor.getOutputDir()
      expect(outputDir).toContain('./out/')
      expect(outputDir).toContain(processor.getToday())
    })

    it('should provide today string', () => {
      const today = processor.getToday()
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should provide video name', () => {
      const videoName = processor.getVideoName()
      expect(videoName).toContain('每日全球热点新闻资讯')
    })
  })
})