import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TestEnvironment, MockUtils } from '../utils/test-helpers.ts'

// Mock all external dependencies for integration test
vi.mock('fs')
vi.mock('../../lib/logger.ts', () => ({ default: MockUtils.mockLogger() }))
vi.mock('../../lib/email.ts', () => ({ sendMail: vi.fn().mockResolvedValue(true) }))

describe('Integration Tests', () => {
  beforeAll(() => {
    TestEnvironment.setupMinimalTestEnv()
  })

  afterAll(() => {
    TestEnvironment.restoreEnv()
  })

  describe('Application Configuration', () => {
    it('should load and validate complete application configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      expect(configManager.isConfigured()).toBe(true)
      
      const config = configManager.getConfig()
      expect(config.api.qwenApiKey).toBeDefined()
      expect(config.email.user).toBeDefined()
      expect(config.app.cronSchedule).toBeDefined()
      expect(config.video.layouts).toBeDefined()
    })
  })

  describe('Core Module Integration', () => {
    it('should integrate NewsProcessor with configuration', async () => {
      const { default: NewsProcessor } = await import('../../core/NewsProcessor.ts')
      
      const processor = new NewsProcessor()
      
      expect(processor.getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(processor.getVideoName()).toContain('每日全球热点新闻资讯')
      expect(processor.getOutputDir()).toContain('./out/')
    })

    it('should integrate ErrorHandler with other modules', async () => {
      const { default: ErrorHandler } = await import('../../core/ErrorHandler.ts')
      
      const context = ErrorHandler.createContext('integration-test')
      expect(context.operation).toBe('integration-test')
      expect(context.timestamp).toBeInstanceOf(Date)
      
      const testError = new Error('Test integration error')
      const result = await ErrorHandler.handle(testError, context)
      
      expect(result.success).toBe(false)
      expect(result.errorType).toBeDefined()
    })
  })

  describe('Configuration and Error Handling Integration', () => {
    it('should handle configuration errors gracefully', async () => {
      TestEnvironment.restoreEnv()
      TestEnvironment.setTestEnv({
        // Invalid configuration
        QWEN_API_KEY: '',
      })

      try {
        const { configManager } = await import('../../config/index.ts')
        expect(configManager.isConfigured()).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Configuration validation failed')
      }
    })
  })

  describe('Module Dependency Chain', () => {
    it('should verify all core modules can be imported together', async () => {
      const modules = await Promise.all([
        import('../../config/index.ts'),
        import('../../core/ErrorHandler.ts'),
        import('../../core/TaskScheduler.ts'),
        import('../../core/NewsProcessor.ts'),
        import('../../core/VideoGenerator.ts'),
        import('../../core/PlatformUploadManager.ts'),
      ])

      expect(modules).toHaveLength(6)
      modules.forEach(module => {
        expect(module).toBeDefined()
        expect(module.default).toBeDefined()
      })
    })
  })

  describe('System Health Check', () => {
    it('should perform basic system health validation', async () => {
      const { configManager } = await import('../../config/index.ts')
      const { default: PlatformUploadManager } = await import('../../core/PlatformUploadManager.ts')
      
      // Check configuration health
      expect(configManager.isConfigured()).toBe(true)
      
      // Check platform manager initialization
      const uploadManager = new PlatformUploadManager()
      const availablePlatforms = uploadManager.getAvailablePlatforms()
      expect(Array.isArray(availablePlatforms)).toBe(true)
      
      await uploadManager.cleanup()
    })
  })

  describe('Error Propagation', () => {
    it('should properly propagate errors through the system', async () => {
      const { default: ErrorHandler } = await import('../../core/ErrorHandler.ts')
      
      const mockOperation = vi.fn().mockRejectedValue(new Error('System error'))
      const context = ErrorHandler.createContext('system-test')
      
      try {
        await ErrorHandler.executeWithRetry(mockOperation, context, { maxAttempts: 1 })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('System error')
      }
      
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })
  })
})