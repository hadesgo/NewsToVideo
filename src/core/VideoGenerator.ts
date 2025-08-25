import fs from 'fs'
import path from 'path'
import logger from '../lib/logger.ts'
import genVideo from '../lib/video.ts'
import ErrorHandler, { AppError, ErrorType } from './ErrorHandler.ts'
import configManager from '../config/index.ts'
import { NewsVideoConfig, LayoutType } from '../type.ts'

/**
 * 视频生成选项
 */
export interface VideoGenerationOptions {
  outputPath?: string
  quality?: 'high' | 'medium' | 'low'
  fps?: number
  enableAudio?: boolean
  enableSubtitles?: boolean
}

/**
 * 视频生成结果
 */
export interface VideoGenerationResult {
  success: boolean
  outputPath: string
  fileSize: number
  duration: number
  resolution: {
    width: number
    height: number
  }
  metadata?: {
    fps: number
    bitrate: number
    codec: string
  }
}

/**
 * 进度回调类型
 */
export type VideoProgressCallback = (step: string, progress: number) => void

/**
 * 视频生成器
 */
export class VideoGenerator {
  private config: NewsVideoConfig
  private options: VideoGenerationOptions
  private outputPath: string

  constructor(
    config: NewsVideoConfig,
    outputPath: string,
    options: VideoGenerationOptions = {}
  ) {
    this.config = config
    this.outputPath = outputPath
    this.options = {
      quality: 'high',
      fps: configManager.getVideoConfig().fps,
      enableAudio: true,
      enableSubtitles: true,
      ...options,
    }

    this.validateConfig()
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!this.config.layers || this.config.layers.length === 0) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'Video config must contain at least one layer',
        ErrorHandler.createContext('video-generator', 'validate-config')
      )
    }

    for (let i = 0; i < this.config.layers.length; i++) {
      const layer = this.config.layers[i]
      
      if (!layer.news) {
        throw new AppError(
          ErrorType.VALIDATION_ERROR,
          `Layer ${i} missing news data`,
          ErrorHandler.createContext('video-generator', 'validate-config', { layerIndex: i })
        )
      }

      if (!layer.audio?.path || !fs.existsSync(layer.audio.path)) {
        throw new AppError(
          ErrorType.FILE_ERROR,
          `Layer ${i} audio file not found: ${layer.audio?.path}`,
          ErrorHandler.createContext('video-generator', 'validate-config', { layerIndex: i, audioPath: layer.audio?.path })
        )
      }

      if (!layer.material?.path || !fs.existsSync(layer.material.path)) {
        throw new AppError(
          ErrorType.FILE_ERROR,
          `Layer ${i} material file not found: ${layer.material?.path}`,
          ErrorHandler.createContext('video-generator', 'validate-config', { layerIndex: i, materialPath: layer.material?.path })
        )
      }

      if (!layer.talkVideo?.path || !fs.existsSync(layer.talkVideo.path)) {
        throw new AppError(
          ErrorType.FILE_ERROR,
          `Layer ${i} talk video file not found: ${layer.talkVideo?.path}`,
          ErrorHandler.createContext('video-generator', 'validate-config', { layerIndex: i, talkVideoPath: layer.talkVideo?.path })
        )
      }

      if (!layer.duration || layer.duration <= 0) {
        throw new AppError(
          ErrorType.VALIDATION_ERROR,
          `Layer ${i} has invalid duration: ${layer.duration}`,
          ErrorHandler.createContext('video-generator', 'validate-config', { layerIndex: i, duration: layer.duration })
        )
      }
    }
  }

  /**
   * 检查依赖文件
   */
  private checkDependencies(): void {
    const requiredAssets = [
      `./assets/Opening-${this.config.layout}.mp4`,
      './assets/logo.png',
      './assets/Ending.wav',
    ]

    if (this.config.layout === 'landscape') {
      requiredAssets.push('./assets/backgroud_video.mp4')
    }

    for (const asset of requiredAssets) {
      if (!fs.existsSync(asset)) {
        throw new AppError(
          ErrorType.FILE_ERROR,
          `Required asset file not found: ${asset}`,
          ErrorHandler.createContext('video-generator', 'check-dependencies', { assetPath: asset })
        )
      }
    }
  }

  /**
   * 创建输出目录
   */
  private ensureOutputDirectory(): void {
    const outputDir = path.dirname(this.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      logger.info(`Created output directory: ${outputDir}`)
    }
  }

  /**
   * 生成视频
   */
  public async generateVideo(
    progressCallback?: VideoProgressCallback
  ): Promise<VideoGenerationResult> {
    return ErrorHandler.executeWithRetry(
      async () => {
        logger.info(`Starting video generation: ${this.outputPath}`)
        progressCallback?.('Initializing video generation', 0)

        // 检查依赖
        this.checkDependencies()
        this.ensureOutputDirectory()

        // 检查是否已存在
        if (fs.existsSync(this.outputPath)) {
          logger.warn(`Output file already exists, removing: ${this.outputPath}`)
          fs.unlinkSync(this.outputPath)
        }

        progressCallback?.('Preparing video layers', 10)

        // 计算总时长
        const totalDuration = this.calculateTotalDuration()
        
        progressCallback?.('Generating video content', 30)

        // 生成视频
        await genVideo(this.config, this.outputPath)

        progressCallback?.('Finalizing video', 90)

        // 验证输出文件
        if (!fs.existsSync(this.outputPath)) {
          throw new AppError(
            ErrorType.PROCESSING_ERROR,
            'Video generation completed but output file not found',
            ErrorHandler.createContext('video-generator', 'generate-video', { outputPath: this.outputPath })
          )
        }

        // 获取文件信息
        const stats = fs.statSync(this.outputPath)
        const resolution = this.getResolutionForLayout(this.config.layout)

        progressCallback?.('Video generation completed', 100)

        const result: VideoGenerationResult = {
          success: true,
          outputPath: this.outputPath,
          fileSize: stats.size,
          duration: totalDuration,
          resolution,
          metadata: {
            fps: this.options.fps || 30,
            bitrate: this.estimateBitrate(stats.size, totalDuration),
            codec: 'h264',
          },
        }

        logger.info(`Video generation completed: ${this.outputPath} (${this.formatFileSize(stats.size)})`)
        return result
      },
      ErrorHandler.createContext('video-generator', 'generate-video', { 
        outputPath: this.outputPath,
        layout: this.config.layout,
        layersCount: this.config.layers.length 
      }),
      { 
        maxAttempts: 2, 
        baseDelay: 5000,
        maxDelay: 30000 
      }
    )
  }

  /**
   * 计算总时长
   */
  private calculateTotalDuration(): number {
    const openingDuration = 3 // 开场视频时长
    const endingDuration = 3 // 结尾视频时长
    const contentDuration = this.config.layers.reduce((total, layer) => total + layer.duration, 0)
    
    return openingDuration + contentDuration + endingDuration
  }

  /**
   * 根据布局获取分辨率
   */
  private getResolutionForLayout(layout: LayoutType): { width: number, height: number } {
    switch (layout) {
      case 'landscape':
        return { width: 1920, height: 1080 }
      case 'portrait':
        return { width: 1080, height: 1920 }
      default:
        throw new Error(`Unsupported layout: ${layout}`)
    }
  }

  /**
   * 估算比特率
   */
  private estimateBitrate(fileSize: number, duration: number): number {
    // 比特率 = 文件大小(字节) * 8 / 时长(秒)
    return Math.round((fileSize * 8) / duration)
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 获取视频信息
   */
  public getVideoInfo(): {
    layout: LayoutType
    layersCount: number
    totalDuration: number
    resolution: { width: number, height: number }
    estimatedFileSize: string
  } {
    const totalDuration = this.calculateTotalDuration()
    const resolution = this.getResolutionForLayout(this.config.layout)
    
    // 估算文件大小（基于分辨率和时长的粗略估算）
    const estimatedBitrate = this.config.layout === 'portrait' ? 2000000 : 4000000 // 2Mbps for portrait, 4Mbps for landscape
    const estimatedSize = (estimatedBitrate * totalDuration) / 8 // bytes

    return {
      layout: this.config.layout,
      layersCount: this.config.layers.length,
      totalDuration,
      resolution,
      estimatedFileSize: this.formatFileSize(estimatedSize),
    }
  }

  /**
   * 验证视频完整性
   */
  public async validateVideo(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.outputPath)) {
        return false
      }

      const stats = fs.statSync(this.outputPath)
      
      // 检查文件大小（至少应该有一些内容）
      if (stats.size < 1024) { // 小于 1KB
        logger.warn(`Video file too small: ${stats.size} bytes`)
        return false
      }

      // 可以在这里添加更多的视频完整性检查
      // 比如使用 ffprobe 检查视频元数据等

      return true
    }
    catch (error) {
      logger.error(`Video validation failed: ${error}`)
      return false
    }
  }

  /**
   * 清理临时文件
   */
  public async cleanup(): Promise<void> {
    try {
      // 在这里可以清理视频生成过程中产生的临时文件
      logger.info('VideoGenerator cleanup completed')
    }
    catch (error) {
      logger.error(`VideoGenerator cleanup failed: ${error}`)
    }
  }

  /**
   * 获取支持的视频格式
   */
  public static getSupportedFormats(): string[] {
    return ['mp4', 'avi', 'mov', 'mkv']
  }

  /**
   * 获取推荐的视频设置
   */
  public static getRecommendedSettings(layout: LayoutType): VideoGenerationOptions {
    const baseSettings: VideoGenerationOptions = {
      enableAudio: true,
      enableSubtitles: true,
    }

    switch (layout) {
      case 'portrait':
        return {
          ...baseSettings,
          quality: 'high',
          fps: 30,
        }
      case 'landscape':
        return {
          ...baseSettings,
          quality: 'high',
          fps: 30,
        }
      default:
        return baseSettings
    }
  }
}

/**
 * 批量视频生成器
 */
export class BatchVideoGenerator {
  private generators: VideoGenerator[] = []

  /**
   * 添加视频生成任务
   */
  public addTask(
    config: NewsVideoConfig,
    outputPath: string,
    options?: VideoGenerationOptions
  ): void {
    const generator = new VideoGenerator(config, outputPath, options)
    this.generators.push(generator)
  }

  /**
   * 批量生成视频
   */
  public async generateAll(
    progressCallback?: (taskIndex: number, taskProgress: number, totalTasks: number) => void
  ): Promise<VideoGenerationResult[]> {
    const results: VideoGenerationResult[] = []

    for (let i = 0; i < this.generators.length; i++) {
      const generator = this.generators[i]
      
      try {
        logger.info(`Generating video ${i + 1}/${this.generators.length}`)
        
        const result = await generator.generateVideo((step, progress) => {
          progressCallback?.(i, progress, this.generators.length)
        })
        
        results.push(result)
        logger.info(`Completed video ${i + 1}/${this.generators.length}`)
      }
      catch (error) {
        logger.error(`Failed to generate video ${i + 1}/${this.generators.length}: ${error}`)
        
        // 添加失败结果
        results.push({
          success: false,
          outputPath: generator['outputPath'],
          fileSize: 0,
          duration: 0,
          resolution: { width: 0, height: 0 },
        })
        
        // 继续处理下一个视频，不中断整个批次
      }
    }

    return results
  }

  /**
   * 清理所有生成器
   */
  public async cleanup(): Promise<void> {
    await Promise.all(this.generators.map(generator => generator.cleanup()))
    this.generators = []
  }
}

export default VideoGenerator