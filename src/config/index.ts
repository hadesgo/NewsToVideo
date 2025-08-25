import 'dotenv/config'
import { LayoutType } from '../type.ts'

/**
 * 应用配置接口
 */
export interface AppConfig {
  api: {
    qwenApiKey: string
    pexelsApiKey: string
    tencentSecretId: string
    tencentSecretKey: string
    tencentRegion: string
  }
  email: {
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    user: string
    pass: string
    to: string
  }
  app: {
    cronSchedule: string
    timezone: string
    logLevel: string
    maxRetryCount: number
    talkVideoServiceUrl: string
  }
  platforms: {
    douyinEnabled: boolean
    bilibiliEnabled: boolean
    tencentVideoEnabled: boolean
  }
  video: {
    layouts: LayoutType[]
    defaultQuality: string
    fps: number
    maxDuration: number
  }
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(`Configuration validation failed: ${message}`)
    this.name = 'ConfigValidationError'
  }
}

/**
 * 配置管理器
 */
class ConfigManager {
  private config: AppConfig

  constructor() {
    this.config = this.loadConfig()
    this.validateConfig()
  }

  /**
   * 加载配置
   */
  private loadConfig(): AppConfig {
    return {
      api: {
        qwenApiKey: process.env.QWEN_API_KEY || '',
        pexelsApiKey: process.env.PEXELS_API_KEY || '',
        tencentSecretId: process.env.TENCENT_SECRET_ID || '',
        tencentSecretKey: process.env.TENCENT_SECRET_KEY || '',
        tencentRegion: process.env.TENCENT_REGION || 'ap-beijing',
      },
      email: {
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        to: process.env.EMAIL_TO || '',
      },
      app: {
        cronSchedule: process.env.CRON_SCHEDULE || '0 17 * * *',
        timezone: process.env.TIMEZONE || 'Asia/Shanghai',
        logLevel: process.env.LOG_LEVEL || 'info',
        maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT || '3'),
        talkVideoServiceUrl: process.env.TALK_VIDEO_SERVICE_URL || 'http://192.168.7.240:3000',
      },
      platforms: {
        douyinEnabled: process.env.DOUYIN_ENABLED !== 'false',
        bilibiliEnabled: process.env.BILIBILI_ENABLED !== 'false',
        tencentVideoEnabled: process.env.TENCENT_VIDEO_ENABLED !== 'false',
      },
      video: {
        layouts: (process.env.VIDEO_LAYOUTS?.split(',') as LayoutType[]) || ['portrait'],
        defaultQuality: process.env.DEFAULT_VIDEO_QUALITY || '1080p',
        fps: parseInt(process.env.VIDEO_FPS || '30'),
        maxDuration: parseInt(process.env.MAX_VIDEO_DURATION || '300'),
      },
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    const { api, email } = this.config

    // 验证必需的API密钥
    if (!api.qwenApiKey) {
      throw new ConfigValidationError('QWEN_API_KEY is required')
    }

    if (!api.tencentSecretId || !api.tencentSecretKey) {
      throw new ConfigValidationError('Tencent Cloud credentials are required')
    }

    // 验证邮件配置
    if (!email.user || !email.pass || !email.to) {
      throw new ConfigValidationError('Email configuration is incomplete')
    }

    // 验证端口号
    if (isNaN(email.smtpPort) || email.smtpPort <= 0) {
      throw new ConfigValidationError('Invalid SMTP port')
    }

    // 验证视频配置
    if (this.config.video.layouts.length === 0) {
      throw new ConfigValidationError('At least one video layout must be specified')
    }

    const validLayouts = ['portrait', 'landscape']
    for (const layout of this.config.video.layouts) {
      if (!validLayouts.includes(layout)) {
        throw new ConfigValidationError(`Invalid video layout: ${layout}`)
      }
    }
  }

  /**
   * 获取配置
   */
  public getConfig(): AppConfig {
    return { ...this.config }
  }

  /**
   * 获取API配置
   */
  public getApiConfig() {
    return { ...this.config.api }
  }

  /**
   * 获取邮件配置
   */
  public getEmailConfig() {
    return { ...this.config.email }
  }

  /**
   * 获取应用配置
   */
  public getAppConfig() {
    return { ...this.config.app }
  }

  /**
   * 获取平台配置
   */
  public getPlatformConfig() {
    return { ...this.config.platforms }
  }

  /**
   * 获取视频配置
   */
  public getVideoConfig() {
    return { ...this.config.video }
  }

  /**
   * 更新配置（用于运行时配置修改）
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates }
    this.validateConfig()
  }

  /**
   * 检查配置是否已初始化
   */
  public isConfigured(): boolean {
    try {
      this.validateConfig()
      return true
    }
    catch {
      return false
    }
  }
}

// 导出单例实例
export const configManager = new ConfigManager()
export default configManager