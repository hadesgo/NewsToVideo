import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TestEnvironment, TestAssertions } from '../utils/test-helpers.ts'

// Mock dotenv before importing the config module
vi.mock('dotenv/config', () => ({}))

describe('ConfigManager', () => {
  beforeEach(() => {
    TestEnvironment.setupMinimalTestEnv()
  })

  afterEach(() => {
    TestEnvironment.restoreEnv()
    vi.clearAllMocks()
  })

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', async () => {
      // 动态导入以确保环境变量已设置
      const { configManager } = await import('../../config/index.ts')
      
      const config = configManager.getConfig()
      
      expect(config).toBeDefined()
      expect(config.api.qwenApiKey).toBe('test-qwen-key')
      expect(config.api.tencentSecretId).toBe('test-secret-id')
      expect(config.email.user).toBe('test@example.com')
    })

    it('should provide default values for optional configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const config = configManager.getConfig()
      
      expect(config.app.cronSchedule).toBe('0 17 * * *')
      expect(config.app.timezone).toBe('Asia/Shanghai')
      expect(config.video.layouts).toEqual(['portrait'])
    })

    it('should validate required configuration', async () => {
      TestEnvironment.restoreEnv()
      TestEnvironment.setTestEnv({
        // 缺少必需的配置
        TENCENT_SECRET_ID: 'test-id',
        // 缺少 QWEN_API_KEY 和其他必需项
      })

      await TestAssertions.assertAsyncThrows(
        () => import('../../config/index.ts'),
        'QWEN_API_KEY is required'
      )
    })
  })

  describe('Configuration Access', () => {
    it('should provide API configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const apiConfig = configManager.getApiConfig()
      
      expect(apiConfig.qwenApiKey).toBe('test-qwen-key')
      expect(apiConfig.tencentSecretId).toBe('test-secret-id')
      expect(apiConfig.tencentRegion).toBe('ap-beijing')
    })

    it('should provide email configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const emailConfig = configManager.getEmailConfig()
      
      expect(emailConfig.user).toBe('test@example.com')
      expect(emailConfig.pass).toBe('test-password')
      expect(emailConfig.to).toBe('recipient@example.com')
    })

    it('should provide app configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const appConfig = configManager.getAppConfig()
      
      expect(appConfig.cronSchedule).toBe('0 17 * * *')
      expect(appConfig.maxRetryCount).toBe(3)
    })

    it('should provide platform configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const platformConfig = configManager.getPlatformConfig()
      
      expect(platformConfig.douyinEnabled).toBe(true)
      expect(platformConfig.bilibiliEnabled).toBe(true)
      expect(platformConfig.tencentVideoEnabled).toBe(true)
    })

    it('should provide video configuration', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const videoConfig = configManager.getVideoConfig()
      
      expect(videoConfig.layouts).toEqual(['portrait'])
      expect(videoConfig.fps).toBe(30)
      expect(videoConfig.defaultQuality).toBe('1080p')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate video layouts', async () => {
      TestEnvironment.setTestEnv({
        VIDEO_LAYOUTS: 'invalid_layout',
      })

      await TestAssertions.assertAsyncThrows(
        () => import('../../config/index.ts'),
        'Invalid video layout'
      )
    })

    it('should validate SMTP port', async () => {
      TestEnvironment.setTestEnv({
        SMTP_PORT: 'invalid_port',
      })

      await TestAssertions.assertAsyncThrows(
        () => import('../../config/index.ts'),
        'Invalid SMTP port'
      )
    })

    it('should check configuration completeness', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      expect(configManager.isConfigured()).toBe(true)
    })
  })

  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      const originalConfig = configManager.getConfig()
      
      configManager.updateConfig({
        app: {
          ...originalConfig.app,
          maxRetryCount: 5,
        },
      })
      
      const updatedConfig = configManager.getAppConfig()
      expect(updatedConfig.maxRetryCount).toBe(5)
    })

    it('should validate updates', async () => {
      const { configManager } = await import('../../config/index.ts')
      
      expect(() => {
        configManager.updateConfig({
          video: {
            layouts: ['invalid_layout' as any],
            defaultQuality: '1080p',
            fps: 30,
            maxDuration: 300,
          },
        })
      }).toThrow('Invalid video layout')
    })
  })

  describe('Error Handling', () => {
    it('should throw ConfigValidationError for invalid configuration', async () => {
      TestEnvironment.setTestEnv({
        QWEN_API_KEY: '', // 空的API密钥
      })

      await TestAssertions.assertAsyncThrows(
        () => import('../../config/index.ts'),
        'Configuration validation failed'
      )
    })

    it('should handle missing email configuration', async () => {
      TestEnvironment.setTestEnv({
        EMAIL_USER: '', // 空的邮件用户
      })

      await TestAssertions.assertAsyncThrows(
        () => import('../../config/index.ts'),
        'Email configuration is incomplete'
      )
    })
  })
})