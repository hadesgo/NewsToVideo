import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import VideoGenerator, { BatchVideoGenerator } from '../../core/VideoGenerator.ts'
import { TestDataGenerator, MockUtils, TestAssertions } from '../utils/test-helpers.ts'
import type { NewsVideoConfig } from '../../type.ts'

// Mock dependencies
const mockFs = MockUtils.mockFileSystem()
const mockLogger = MockUtils.mockLogger()

vi.mock('fs', () => mockFs)
vi.mock('../../lib/logger.ts', () => ({ default: mockLogger }))
vi.mock('../../lib/video.ts', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../core/ErrorHandler.ts', () => ({
  default: {
    executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
    createContext: vi.fn().mockReturnValue({}),
  },
}))
vi.mock('../../config/index.ts', () => ({
  default: {
    getVideoConfig: () => ({ fps: 30 }),
  },
}))

describe('VideoGenerator', () => {
  let mockConfig: NewsVideoConfig
  let outputPath: string

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockConfig = TestDataGenerator.generateMockVideoConfig('portrait')
    outputPath = '/test/output/video.mp4'
    
    // Setup default mock behaviors
    mockFs.existsSync.mockReturnValue(true) // Files exist by default
    mockFs.mkdirSync.mockReturnValue(undefined)
    mockFs.unlinkSync.mockReturnValue(undefined)
    mockFs.statSync.mockReturnValue({ size: 1024 * 1024 } as any) // 1MB file
  })

  describe('Constructor and Validation', () => {
    it('should create video generator with valid config', () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      expect(generator).toBeDefined()
    })

    it('should validate config on creation', () => {
      const invalidConfig = { ...mockConfig, layers: [] }
      
      expect(() => new VideoGenerator(invalidConfig, outputPath))
        .toThrow('Video config must contain at least one layer')
    })

    it('should validate layer news data', () => {
      const invalidConfig = {
        ...mockConfig,
        layers: [{ ...mockConfig.layers[0], news: null as any }],
      }
      
      expect(() => new VideoGenerator(invalidConfig, outputPath))
        .toThrow('Layer 0 missing news data')
    })

    it('should validate audio file existence', () => {
      mockFs.existsSync.mockImplementation((path) => {
        return !path.toString().includes('audio')
      })
      
      expect(() => new VideoGenerator(mockConfig, outputPath))
        .toThrow('Layer 0 audio file not found')
    })

    it('should validate material file existence', () => {
      mockFs.existsSync.mockImplementation((path) => {
        return !path.toString().includes('material')
      })
      
      expect(() => new VideoGenerator(mockConfig, outputPath))
        .toThrow('Layer 0 material file not found')
    })

    it('should validate talk video file existence', () => {
      mockFs.existsSync.mockImplementation((path) => {
        return !path.toString().includes('talk-video')
      })
      
      expect(() => new VideoGenerator(mockConfig, outputPath))
        .toThrow('Layer 0 talk video file not found')
    })

    it('should validate layer duration', () => {
      const invalidConfig = {
        ...mockConfig,
        layers: [{ ...mockConfig.layers[0], duration: 0 }],
      }
      
      expect(() => new VideoGenerator(invalidConfig, outputPath))
        .toThrow('Layer 0 has invalid duration')
    })
  })

  describe('Dependency Checking', () => {
    it('should check required asset files', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      mockFs.existsSync.mockImplementation((path) => {
        // Mock missing opening video
        if (path.toString().includes('Opening-portrait.mp4')) {
          return false
        }
        return true
      })

      await TestAssertions.assertAsyncThrows(
        () => generator.generateVideo(),
        'Required asset file not found'
      )
    })

    it('should check layout-specific assets', async () => {
      const landscapeConfig = TestDataGenerator.generateMockVideoConfig('landscape')
      const generator = new VideoGenerator(landscapeConfig, outputPath)
      
      mockFs.existsSync.mockImplementation((path) => {
        // Mock missing background video for landscape
        if (path.toString().includes('backgroud_video.mp4')) {
          return false
        }
        return true
      })

      await TestAssertions.assertAsyncThrows(
        () => generator.generateVideo(),
        'Required asset file not found'
      )
    })
  })

  describe('Video Generation', () => {
    it('should generate video successfully', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      const result = await generator.generateVideo()

      expect(result.success).toBe(true)
      expect(result.outputPath).toBe(outputPath)
      expect(result.fileSize).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle progress callback', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      const progressCallback = vi.fn()
      
      await generator.generateVideo(progressCallback)

      expect(progressCallback).toHaveBeenCalledWith('Initializing video generation', 0)
      expect(progressCallback).toHaveBeenCalledWith('Video generation completed', 100)
    })

    it('should remove existing output file', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      mockFs.existsSync.mockImplementation((path) => {
        // Output file exists
        if (path.toString() === outputPath) {
          return true
        }
        return true
      })

      await generator.generateVideo()

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(outputPath)
    })

    it('should create output directory', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      await generator.generateVideo()

      expect(mockFs.mkdirSync).toHaveBeenCalled()
    })

    it('should fail if output file not created', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      mockFs.existsSync.mockImplementation((path) => {
        // Output file doesn't exist after generation
        if (path.toString() === outputPath) {
          return false
        }
        return true
      })

      await TestAssertions.assertAsyncThrows(
        () => generator.generateVideo(),
        'output file not found'
      )
    })
  })

  describe('Video Information', () => {
    it('should provide video information', () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      const info = generator.getVideoInfo()

      expect(info.layout).toBe('portrait')
      expect(info.layersCount).toBe(mockConfig.layers.length)
      expect(info.totalDuration).toBeGreaterThan(0)
      expect(info.resolution).toEqual({ width: 1080, height: 1920 })
      expect(info.estimatedFileSize).toBeDefined()
    })

    it('should calculate total duration correctly', () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      const info = generator.getVideoInfo()
      const expectedDuration = 3 + 3 + mockConfig.layers.reduce((sum, layer) => sum + layer.duration, 0)

      expect(info.totalDuration).toBe(expectedDuration)
    })

    it('should provide correct resolution for different layouts', () => {
      const portraitGenerator = new VideoGenerator(mockConfig, outputPath)
      const landscapeConfig = TestDataGenerator.generateMockVideoConfig('landscape')
      const landscapeGenerator = new VideoGenerator(landscapeConfig, outputPath)

      const portraitInfo = portraitGenerator.getVideoInfo()
      const landscapeInfo = landscapeGenerator.getVideoInfo()

      expect(portraitInfo.resolution).toEqual({ width: 1080, height: 1920 })
      expect(landscapeInfo.resolution).toEqual({ width: 1920, height: 1080 })
    })
  })

  describe('Video Validation', () => {
    it('should validate successful video generation', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ size: 1024 * 1024 } as any)

      const isValid = await generator.validateVideo()

      expect(isValid).toBe(true)
    })

    it('should detect missing video file', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      mockFs.existsSync.mockReturnValue(false)

      const isValid = await generator.validateVideo()

      expect(isValid).toBe(false)
    })

    it('should detect file too small', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      mockFs.existsSync.mockReturnValue(true)
      mockFs.statSync.mockReturnValue({ size: 100 } as any) // Very small file

      const isValid = await generator.validateVideo()

      expect(isValid).toBe(false)
    })
  })

  describe('Static Methods', () => {
    it('should return supported formats', () => {
      const formats = VideoGenerator.getSupportedFormats()
      
      expect(formats).toContain('mp4')
      expect(formats).toContain('avi')
      expect(formats).toContain('mov')
      expect(formats).toContain('mkv')
    })

    it('should provide recommended settings', () => {
      const portraitSettings = VideoGenerator.getRecommendedSettings('portrait')
      const landscapeSettings = VideoGenerator.getRecommendedSettings('landscape')

      expect(portraitSettings.quality).toBe('high')
      expect(portraitSettings.fps).toBe(30)
      expect(portraitSettings.enableAudio).toBe(true)
      
      expect(landscapeSettings.quality).toBe('high')
      expect(landscapeSettings.fps).toBe(30)
      expect(landscapeSettings.enableAudio).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const generator = new VideoGenerator(mockConfig, outputPath)
      
      await expect(generator.cleanup()).resolves.not.toThrow()
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'VideoGenerator cleanup completed'
      )
    })
  })
})

describe('BatchVideoGenerator', () => {
  let batchGenerator: BatchVideoGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    batchGenerator = new BatchVideoGenerator()
    
    mockFs.existsSync.mockReturnValue(true)
    mockFs.statSync.mockReturnValue({ size: 1024 * 1024 } as any)
  })

  describe('Batch Operations', () => {
    it('should add tasks to batch', () => {
      const config1 = TestDataGenerator.generateMockVideoConfig('portrait')
      const config2 = TestDataGenerator.generateMockVideoConfig('landscape')

      batchGenerator.addTask(config1, '/test/video1.mp4')
      batchGenerator.addTask(config2, '/test/video2.mp4')

      expect(batchGenerator['generators']).toHaveLength(2)
    })

    it('should generate all videos in batch', async () => {
      const config1 = TestDataGenerator.generateMockVideoConfig('portrait')
      const config2 = TestDataGenerator.generateMockVideoConfig('landscape')

      batchGenerator.addTask(config1, '/test/video1.mp4')
      batchGenerator.addTask(config2, '/test/video2.mp4')

      const results = await batchGenerator.generateAll()

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    it('should handle progress callback for batch', async () => {
      const config = TestDataGenerator.generateMockVideoConfig('portrait')
      const progressCallback = vi.fn()

      batchGenerator.addTask(config, '/test/video.mp4')

      await batchGenerator.generateAll(progressCallback)

      expect(progressCallback).toHaveBeenCalled()
    })

    it('should continue batch processing after failure', async () => {
      const config1 = TestDataGenerator.generateMockVideoConfig('portrait')
      const config2 = TestDataGenerator.generateMockVideoConfig('landscape')

      batchGenerator.addTask(config1, '/test/video1.mp4')
      batchGenerator.addTask(config2, '/test/video2.mp4')

      // Mock first generation to fail
      const videoModule = await import('../../lib/video.ts')
      vi.mocked(videoModule.default)
        .mockRejectedValueOnce(new Error('Generation failed'))
        .mockResolvedValueOnce(undefined)

      const results = await batchGenerator.generateAll()

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(true)
    })

    it('should cleanup batch generator', async () => {
      const config = TestDataGenerator.generateMockVideoConfig('portrait')
      batchGenerator.addTask(config, '/test/video.mp4')

      await batchGenerator.cleanup()

      expect(batchGenerator['generators']).toHaveLength(0)
    })
  })
})