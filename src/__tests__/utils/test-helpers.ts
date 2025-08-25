import fs from 'fs'
import path from 'path'
import { vi } from 'vitest'

/**
 * 测试数据生成器
 */
export class TestDataGenerator {
  /**
   * 生成模拟新闻数据
   */
  static generateMockNews(count: number = 3) {
    return Array.from({ length: count }, (_, i) => ({
      title: `Test News Title ${i + 1}`,
      content: `This is test news content ${i + 1}. It contains some meaningful text for testing purposes.`,
      keywords: [`keyword${i + 1}`, 'test', 'news'],
    }))
  }

  /**
   * 生成模拟视频配置
   */
  static generateMockVideoConfig(layout: 'portrait' | 'landscape' = 'portrait') {
    const mockNews = this.generateMockNews(2)
    return {
      layout,
      layers: mockNews.map((news, i) => ({
        news: {
          title: news.title,
          content: news.content,
          keywodrs: news.keywords,
        },
        audio: {
          path: `/test/audio/${i}.mp3`,
          subtitles: [],
        },
        talkVideo: {
          path: `/test/talk-video/${i}.mp4`,
        },
        material: {
          path: `/test/material/${i}.png`,
          type: 'image' as const,
        },
        duration: 10 + i * 5,
      })),
    }
  }

  /**
   * 生成临时测试文件
   */
  static createTempFile(content: string, extension: string = '.txt'): string {
    const tempDir = './temp-test'
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const tempFilePath = path.join(tempDir, `test-${Date.now()}${extension}`)
    fs.writeFileSync(tempFilePath, content)
    return tempFilePath
  }

  /**
   * 清理临时测试文件
   */
  static cleanupTempFiles(): void {
    const tempDir = './temp-test'
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

/**
 * Mock 工具类
 */
export class MockUtils {
  /**
   * Mock 文件系统操作
   */
  static mockFileSystem() {
    const mockFs = {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      statSync: vi.fn(),
    }

    vi.doMock('fs', () => mockFs)
    return mockFs
  }

  /**
   * Mock 配置管理器
   */
  static mockConfigManager() {
    const mockConfig = {
      getConfig: vi.fn(() => ({
        api: {
          qwenApiKey: 'test-key',
          pexelsApiKey: 'test-pexels-key',
          tencentSecretId: 'test-id',
          tencentSecretKey: 'test-secret',
          tencentRegion: 'ap-beijing',
        },
        email: {
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpSecure: false,
          user: 'test@example.com',
          pass: 'password',
          to: 'recipient@example.com',
        },
        app: {
          cronSchedule: '0 17 * * *',
          timezone: 'Asia/Shanghai',
          logLevel: 'info',
          maxRetryCount: 3,
          talkVideoServiceUrl: 'http://localhost:3000',
        },
        platforms: {
          douyinEnabled: true,
          bilibiliEnabled: true,
          tencentVideoEnabled: true,
        },
        video: {
          layouts: ['portrait'],
          defaultQuality: '1080p',
          fps: 30,
          maxDuration: 300,
        },
      })),
      getApiConfig: vi.fn(),
      getEmailConfig: vi.fn(),
      getAppConfig: vi.fn(),
      getPlatformConfig: vi.fn(),
      getVideoConfig: vi.fn(),
      isConfigured: vi.fn(() => true),
    }

    return mockConfig
  }

  /**
   * Mock 日志记录器
   */
  static mockLogger() {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }
  }

  /**
   * Mock 邮件发送
   */
  static mockEmailSender() {
    return {
      sendMail: vi.fn().mockResolvedValue(true),
    }
  }
}

/**
 * 测试断言工具
 */
export class TestAssertions {
  /**
   * 断言错误类型
   */
  static assertErrorType(error: any, expectedType: string): void {
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(expectedType)
  }

  /**
   * 断言文件存在
   */
  static assertFileExists(filePath: string): void {
    expect(fs.existsSync(filePath)).toBe(true)
  }

  /**
   * 断言配置有效性
   */
  static assertValidConfig(config: any): void {
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
    expect(config).not.toBeNull()
  }

  /**
   * 断言异步函数抛出特定错误
   */
  static async assertAsyncThrows(
    fn: () => Promise<any>,
    expectedError?: string | RegExp
  ): Promise<void> {
    let error: any
    try {
      await fn()
    } catch (e) {
      error = e
    }
    
    expect(error).toBeDefined()
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError)
      } else {
        expect(error.message).toMatch(expectedError)
      }
    }
  }
}

/**
 * 环境设置工具
 */
export class TestEnvironment {
  private static originalEnv: Record<string, string | undefined> = {}

  /**
   * 设置测试环境变量
   */
  static setTestEnv(env: Record<string, string>): void {
    for (const [key, value] of Object.entries(env)) {
      this.originalEnv[key] = process.env[key]
      process.env[key] = value
    }
  }

  /**
   * 恢复原始环境变量
   */
  static restoreEnv(): void {
    for (const [key, value] of Object.entries(this.originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    this.originalEnv = {}
  }

  /**
   * 设置最小测试环境
   */
  static setupMinimalTestEnv(): void {
    this.setTestEnv({
      QWEN_API_KEY: 'test-qwen-key',
      TENCENT_SECRET_ID: 'test-secret-id',
      TENCENT_SECRET_KEY: 'test-secret-key',
      EMAIL_USER: 'test@example.com',
      EMAIL_PASS: 'test-password',
      EMAIL_TO: 'recipient@example.com',
    })
  }
}

export default {
  TestDataGenerator,
  MockUtils,
  TestAssertions,
  TestEnvironment,
}