import fs from 'fs'
import path from 'path'
import logger from '../lib/logger.ts'
import news from '../lib/news.ts'
import tts from '../lib/tts.ts'
import genImage from '../material/image.ts'
import getVideo from '../material/video.ts'
import { getVideoDurationInSeconds } from '../utils/ffmpeg.ts'
import { genTalkVideo, saveConfig } from '../utils/utils.ts'
import ErrorHandler, { AppError, ErrorType } from './ErrorHandler.ts'
import configManager from '../config/index.ts'
import { NewsVideoConfig, LayoutType } from '../type.ts'

/**
 * 新闻数据接口
 */
export interface NewsData {
  title: string
  content: string
  keywords: string[]
}

/**
 * 音频信息接口
 */
export interface AudioInfo {
  path: string
  subtitles?: any[]
  duration: number
}

/**
 * 素材信息接口
 */
export interface MaterialInfo {
  path: string
  type: 'image' | 'video'
}

/**
 * 口播视频信息接口
 */
export interface TalkVideoInfo {
  path: string
}

/**
 * 处理进度回调类型
 */
export type ProgressCallback = (step: string, progress: number, total: number) => void

/**
 * 新闻处理器
 */
export class NewsProcessor {
  private outputDir: string
  private today: string
  private videoName: string

  constructor(date: Date = new Date()) {
    const formatTodays = this.formatTime(date)
    this.today = formatTodays[0]
    this.videoName = `每日全球热点新闻资讯-${formatTodays[1]}`
    this.outputDir = `./out/${this.today}`
  }

  /**
   * 格式化时间
   */
  private formatTime(date: Date): string[] {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return [`${year}-${month}-${day}`, `${year}年${month}月${day}日`]
  }

  /**
   * 创建输出目录结构
   */
  private ensureDirectories(): void {
    const dirs = [
      this.outputDir,
      path.join(this.outputDir, 'audio'),
      path.join(this.outputDir, 'talk-video'),
    ]

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
        logger.info(`Created directory: ${dir}`)
      }
    }
  }

  /**
   * 获取新闻列表
   */
  public async getNewsList(): Promise<NewsData[]> {
    return ErrorHandler.executeWithRetry(
      async () => {
        const newsJsonFilePath = path.join(this.outputDir, 'news.json')
        
        // 如果已存在新闻文件，直接读取
        if (fs.existsSync(newsJsonFilePath)) {
          const content = fs.readFileSync(newsJsonFilePath, 'utf-8')
          const newsList = JSON.parse(content)
          logger.info(`Loaded existing news list: ${newsList.length} items`)
          return newsList
        }

        // 获取新闻
        const formatTodays = this.formatTime(new Date())
        const newsList = await news(formatTodays[1])
        
        if (!Array.isArray(newsList) || newsList.length === 0) {
          throw new AppError(
            ErrorType.API_ERROR,
            'No news data received from API',
            ErrorHandler.createContext('get-news', 'fetch-news-list'),
            true
          )
        }

        // 保存新闻数据
        this.ensureDirectories()
        fs.writeFileSync(newsJsonFilePath, JSON.stringify(newsList, null, 2))
        logger.info(`Fetched and saved ${newsList.length} news items`)
        
        return newsList
      },
      ErrorHandler.createContext('news-processor', 'get-news-list'),
      { maxAttempts: 3, baseDelay: 2000 }
    )
  }

  /**
   * 生成音频
   */
  public async generateAudio(
    newsItem: NewsData,
    index: number,
    progressCallback?: ProgressCallback
  ): Promise<AudioInfo> {
    return ErrorHandler.executeWithRetry(
      async () => {
        const audioDir = path.join(this.outputDir, 'audio')
        const audioPath = path.join(audioDir, `${index}.mp3`)
        const subtitleFilePath = path.join(audioDir, `${index}.json`)

        // 如果音频文件已存在，直接返回
        if (fs.existsSync(audioPath)) {
          const duration = await getVideoDurationInSeconds(audioPath)
          let subtitles: any[] | undefined

          if (fs.existsSync(subtitleFilePath)) {
            const content = fs.readFileSync(subtitleFilePath, 'utf-8')
            subtitles = JSON.parse(content)
          }

          logger.info(`Audio already exists: ${index}`)
          return { path: audioPath, subtitles, duration }
        }

        progressCallback?.('Generating audio', index, 1)

        // 生成音频
        const audioInfo = await tts(newsItem.content, audioPath)
        
        if (!audioInfo.audio || !fs.existsSync(audioInfo.audio)) {
          throw new AppError(
            ErrorType.PROCESSING_ERROR,
            'Audio generation failed',
            ErrorHandler.createContext('news-processor', 'generate-audio', { index, newsTitle: newsItem.title }),
            true
          )
        }

        // 保存字幕信息
        if (audioInfo.subtitles) {
          fs.writeFileSync(subtitleFilePath, JSON.stringify(audioInfo.subtitles, null, 2))
        }

        // 获取音频时长
        const duration = await getVideoDurationInSeconds(audioInfo.audio)

        logger.info(`Audio generated: ${index}`)
        return {
          path: audioInfo.audio,
          subtitles: audioInfo.subtitles,
          duration,
        }
      },
      ErrorHandler.createContext('news-processor', 'generate-audio', { index, newsTitle: newsItem.title }),
      { maxAttempts: 2, baseDelay: 1000 }
    )
  }

  /**
   * 获取素材（视频或图片）
   */
  public async getMaterial(
    newsItem: NewsData,
    layout: LayoutType,
    duration: number,
    index: number,
    progressCallback?: ProgressCallback
  ): Promise<MaterialInfo> {
    return ErrorHandler.executeWithRetry(
      async () => {
        const materialDir = path.join(this.outputDir, layout, 'material')
        fs.mkdirSync(materialDir, { recursive: true })

        progressCallback?.('Getting material', index, 1)

        // 先尝试获取视频素材
        try {
          const videoPath = await getVideo(newsItem.keywords.join(', '), layout, duration, materialDir, index)
          if (videoPath && fs.existsSync(videoPath)) {
            logger.info(`Video material obtained: ${index}`)
            return { path: videoPath, type: 'video' }
          }
        }
        catch (error) {
          logger.warn(`Failed to get video material for index ${index}, falling back to image: ${error}`)
        }

        // 如果视频获取失败，使用图片
        const imagePath = path.join(materialDir, `${index}.png`)
        
        if (!fs.existsSync(imagePath)) {
          const { width, height } = this.getResolutionForLayout(layout)
          await genImage(newsItem.keywords.join(', '), `${width}x${height}`, imagePath)
        }

        if (!fs.existsSync(imagePath)) {
          throw new AppError(
            ErrorType.PROCESSING_ERROR,
            'Failed to generate image material',
            ErrorHandler.createContext('news-processor', 'get-material', { index, keywords: newsItem.keywords }),
            true
          )
        }

        logger.info(`Image material generated: ${index}`)
        return { path: imagePath, type: 'image' }
      },
      ErrorHandler.createContext('news-processor', 'get-material', { index, layout, keywords: newsItem.keywords }),
      { maxAttempts: 2, baseDelay: 1000 }
    )
  }

  /**
   * 生成口播视频
   */
  public async generateTalkVideo(
    audioPath: string,
    index: number,
    progressCallback?: ProgressCallback
  ): Promise<TalkVideoInfo> {
    return ErrorHandler.executeWithRetry(
      async () => {
        const talkVideoDir = path.join(this.outputDir, 'talk-video')
        const talkVideoPath = path.join(talkVideoDir, `${index}.mp4`)

        // 如果已存在，直接返回
        if (fs.existsSync(talkVideoPath)) {
          logger.info(`Talk video already exists: ${index}`)
          return { path: talkVideoPath }
        }

        progressCallback?.('Generating talk video', index, 1)

        await genTalkVideo(audioPath, talkVideoPath, this.today, index)

        if (!fs.existsSync(talkVideoPath)) {
          throw new AppError(
            ErrorType.PROCESSING_ERROR,
            'Talk video generation failed',
            ErrorHandler.createContext('news-processor', 'generate-talk-video', { index, audioPath }),
            true
          )
        }

        logger.info(`Talk video generated: ${index}`)
        return { path: talkVideoPath }
      },
      ErrorHandler.createContext('news-processor', 'generate-talk-video', { index, audioPath }),
      { maxAttempts: 2, baseDelay: 2000 }
    )
  }

  /**
   * 处理单个布局的所有新闻
   */
  public async processNewsForLayout(
    newsList: NewsData[],
    layout: LayoutType,
    progressCallback?: ProgressCallback
  ): Promise<NewsVideoConfig> {
    const layoutDir = path.join(this.outputDir, layout)
    const configPath = path.join(layoutDir, 'config.json')
    
    fs.mkdirSync(layoutDir, { recursive: true })

    // 加载已有配置或创建新配置
    let videoConfig: NewsVideoConfig = { layers: [], layout }
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8')
      videoConfig = JSON.parse(content)
    }

    logger.info(`Processing ${newsList.length} news items for layout: ${layout}`)

    for (let i = 0; i < newsList.length; i++) {
      const newsItem = newsList[i]
      
      progressCallback?.(`Processing news ${i + 1}`, i, newsList.length)

      // 确保 layer 存在
      if (!videoConfig.layers[i]) {
        videoConfig.layers[i] = {} as any
      }

      const layer = videoConfig.layers[i]

      // 设置新闻信息
      layer.news = {
        title: newsItem.title,
        content: newsItem.content,
        keywodrs: newsItem.keywords
      }

      // 生成音频（如果尚未生成）
      if (!layer.audio?.path) {
        const audioInfo = await this.generateAudio(newsItem, i, progressCallback)
        layer.audio = {
          path: audioInfo.path,
          subtitles: audioInfo.subtitles
        }
        layer.duration = audioInfo.duration
        saveConfig(videoConfig, configPath)
      }

      // 获取素材（如果尚未获取）
      if (!layer.material?.path) {
        const materialInfo = await this.getMaterial(newsItem, layout, layer.duration, i, progressCallback)
        layer.material = {
          path: materialInfo.path,
          type: materialInfo.type
        }
        saveConfig(videoConfig, configPath)
      }

      // 生成口播视频（如果尚未生成）
      if (!layer.talkVideo?.path) {
        const talkVideoInfo = await this.generateTalkVideo(layer.audio.path, i, progressCallback)
        layer.talkVideo = {
          path: talkVideoInfo.path
        }
        saveConfig(videoConfig, configPath)
      }

      logger.info(`Completed processing news ${i + 1}/${newsList.length}: ${newsItem.title}`)
    }

    // 保存最终配置
    saveConfig(videoConfig, configPath)
    logger.info(`Completed processing all news for layout: ${layout}`)

    return videoConfig
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
   * 处理所有新闻
   */
  public async processAllNews(
    progressCallback?: ProgressCallback
  ): Promise<{ newsList: NewsData[], configs: Map<LayoutType, NewsVideoConfig> }> {
    this.ensureDirectories()

    // 获取新闻列表
    progressCallback?.('Fetching news', 0, 1)
    const newsList = await this.getNewsList()

    if (newsList.length === 0) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        'No news items to process',
        ErrorHandler.createContext('news-processor', 'process-all-news')
      )
    }

    // 获取支持的布局
    const layouts = configManager.getVideoConfig().layouts
    const configs = new Map<LayoutType, NewsVideoConfig>()

    // 处理每种布局
    for (const layout of layouts) {
      progressCallback?.(`Processing layout: ${layout}`, 0, layouts.length)
      
      try {
        const config = await this.processNewsForLayout(newsList, layout, progressCallback)
        configs.set(layout, config)
        logger.info(`Successfully processed layout: ${layout}`)
      }
      catch (error) {
        logger.error(`Failed to process layout ${layout}: ${error}`)
        await ErrorHandler.handle(
          error,
          ErrorHandler.createContext('news-processor', 'process-layout', { layout })
        )
        throw error
      }
    }

    return { newsList, configs }
  }

  /**
   * 获取输出目录
   */
  public getOutputDir(): string {
    return this.outputDir
  }

  /**
   * 获取今日标识
   */
  public getToday(): string {
    return this.today
  }

  /**
   * 获取视频名称
   */
  public getVideoName(): string {
    return this.videoName
  }

  /**
   * 清理临时文件
   */
  public async cleanup(): Promise<void> {
    try {
      // 可以在这里添加清理逻辑，比如删除临时文件等
      logger.info('NewsProcessor cleanup completed')
    }
    catch (error) {
      logger.error(`NewsProcessor cleanup failed: ${error}`)
    }
  }
}

export default NewsProcessor