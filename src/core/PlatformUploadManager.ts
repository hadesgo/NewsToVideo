import fs from "fs";
import logger from "../lib/logger.ts";
import { DouYinVideo } from "../lib/douyin.ts";
import { BilibiliVideo } from "../lib/bilibili.ts";
import { TencentVideo } from "../lib/tencent.ts";
import ErrorHandler, { AppError, ErrorType } from "./ErrorHandler.ts";
import configManager from "../config/index.ts";
import { LayoutType } from "../type.ts";

/**
 * 平台类型枚举
 */
export enum PlatformType {
  DOUYIN = "douyin",
  BILIBILI = "bilibili",
  TENCENT = "tencent",
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  platform: PlatformType;
  success: boolean;
  message: string;
  videoId?: string;
  url?: string;
  uploadTime: Date;
  duration: number;
  error?: string;
}

/**
 * 平台配置接口
 */
export interface PlatformConfig {
  enabled: boolean;
  tags: string[];
  thumbnail?: string;
  accountFile?: string;
  category?: string;
  title?: string;
  description?: string;
}

/**
 * 上传选项接口
 */
export interface UploadOptions {
  title: string;
  tags: string[];
  thumbnail?: string;
  description?: string;
  category?: string;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * 进度回调类型
 */
export type UploadProgressCallback = (
  platform: PlatformType,
  progress: number,
  message: string
) => void;

/**
 * 平台上传器基类
 */
abstract class BasePlatformUploader {
  protected platform: PlatformType;
  protected config: PlatformConfig;

  constructor(platform: PlatformType, config: PlatformConfig) {
    this.platform = platform;
    this.config = config;
  }

  /**
   * 上传视频
   */
  abstract upload(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult>;

  /**
   * 验证配置
   */
  protected validateConfig(): void {
    if (!this.config.enabled) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `Platform ${this.platform} is disabled`,
        ErrorHandler.createContext("platform-uploader", "validate-config", {
          platform: this.platform,
        })
      );
    }
  }

  /**
   * 验证视频文件
   */
  protected validateVideoFile(videoPath: string): void {
    if (!fs.existsSync(videoPath)) {
      throw new AppError(
        ErrorType.FILE_ERROR,
        `Video file not found: ${videoPath}`,
        ErrorHandler.createContext("platform-uploader", "validate-video", {
          videoPath,
          platform: this.platform,
        })
      );
    }

    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      throw new AppError(
        ErrorType.FILE_ERROR,
        `Video file is empty: ${videoPath}`,
        ErrorHandler.createContext("platform-uploader", "validate-video", {
          videoPath,
          platform: this.platform,
        })
      );
    }
  }

  /**
   * 创建上传结果
   */
  protected createResult(
    success: boolean,
    message: string,
    startTime: Date,
    videoId?: string,
    url?: string,
    error?: string
  ): UploadResult {
    return {
      platform: this.platform,
      success,
      message,
      videoId,
      url,
      uploadTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      error,
    };
  }
}

/**
 * 抖音上传器
 */
class DouyinUploader extends BasePlatformUploader {
  constructor(config: PlatformConfig) {
    super(PlatformType.DOUYIN, config);
  }

  async upload(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult> {
    const startTime = new Date();

    try {
      this.validateConfig();
      this.validateVideoFile(videoPath);

      progressCallback?.(this.platform, 0, "Preparing upload to Douyin");

      const douyinVideo = new DouYinVideo(
        options.title,
        videoPath,
        options.tags,
        options.thumbnail ||
          this.config.thumbnail ||
          `./assets/thumbnail-portrait.png`,
        this.config.accountFile || "./out/douyin_account.json"
      );

      progressCallback?.(this.platform, 30, "Uploading to Douyin");

      await douyinVideo.upload();

      progressCallback?.(this.platform, 100, "Upload to Douyin completed");

      return this.createResult(true, "Upload to Douyin successful", startTime);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Douyin upload failed: ${errorMessage}`);

      return this.createResult(
        false,
        "Upload to Douyin failed",
        startTime,
        undefined,
        undefined,
        errorMessage
      );
    }
  }
}

/**
 * B站上传器
 */
class BilibiliUploader extends BasePlatformUploader {
  constructor(config: PlatformConfig) {
    super(PlatformType.BILIBILI, config);
  }

  async upload(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult> {
    const startTime = new Date();

    try {
      this.validateConfig();
      this.validateVideoFile(videoPath);

      progressCallback?.(this.platform, 0, "Preparing upload to Bilibili");

      const bilibiliVideo = new BilibiliVideo(
        options.title,
        videoPath,
        options.tags,
        this.config.accountFile || "./out/bilibili_account.json"
      );

      progressCallback?.(this.platform, 30, "Uploading to Bilibili");

      await bilibiliVideo.upload();

      progressCallback?.(this.platform, 100, "Upload to Bilibili completed");

      return this.createResult(
        true,
        "Upload to Bilibili successful",
        startTime
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Bilibili upload failed: ${errorMessage}`);

      return this.createResult(
        false,
        "Upload to Bilibili failed",
        startTime,
        undefined,
        undefined,
        errorMessage
      );
    }
  }
}

/**
 * 腾讯视频号上传器
 */
class TencentUploader extends BasePlatformUploader {
  constructor(config: PlatformConfig) {
    super(PlatformType.TENCENT, config);
  }

  async upload(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult> {
    const startTime = new Date();

    try {
      this.validateConfig();
      this.validateVideoFile(videoPath);

      progressCallback?.(this.platform, 0, "Preparing upload to Tencent Video");

      const tencentVideo = new TencentVideo(
        options.title,
        videoPath,
        options.tags,
        this.config.accountFile || "./out/tencent_account.json",
        options.category || this.config.category || "新闻资讯"
      );

      progressCallback?.(this.platform, 30, "Uploading to Tencent Video");

      await tencentVideo.upload();

      progressCallback?.(
        this.platform,
        100,
        "Upload to Tencent Video completed"
      );

      return this.createResult(
        true,
        "Upload to Tencent Video successful",
        startTime
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Tencent Video upload failed: ${errorMessage}`);

      return this.createResult(
        false,
        "Upload to Tencent Video failed",
        startTime,
        undefined,
        undefined,
        errorMessage
      );
    }
  }
}

/**
 * 平台上传管理器
 */
export class PlatformUploadManager {
  private uploaders: Map<PlatformType, BasePlatformUploader> = new Map();
  private defaultOptions: Partial<UploadOptions>;

  constructor() {
    this.defaultOptions = {
      enableRetry: true,
      maxRetries: configManager.getAppConfig().maxRetryCount,
      retryDelay: 2000,
    };

    this.initializeUploaders();
  }

  /**
   * 初始化上传器
   */
  private initializeUploaders(): void {
    const platformConfig = configManager.getPlatformConfig();

    // 抖音上传器
    if (platformConfig.douyinEnabled) {
      this.uploaders.set(
        PlatformType.DOUYIN,
        new DouyinUploader({
          enabled: platformConfig.douyinEnabled,
          tags: ["热点", "热点新闻事件"],
          thumbnail: "./assets/thumbnail-portrait.png",
          accountFile: "./out/douyin_account.json",
        })
      );
    }

    // B站上传器
    if (platformConfig.bilibiliEnabled) {
      this.uploaders.set(
        PlatformType.BILIBILI,
        new BilibiliUploader({
          enabled: platformConfig.bilibiliEnabled,
          tags: ["热点", "资讯", "全球"],
          accountFile: "./out/bilibili_account.json",
        })
      );
    }

    // 腾讯视频号上传器
    if (platformConfig.tencentVideoEnabled) {
      this.uploaders.set(
        PlatformType.TENCENT,
        new TencentUploader({
          enabled: platformConfig.tencentVideoEnabled,
          tags: ["热点", "资讯", "全球"],
          accountFile: "./out/tencent_account.json",
          category: "新闻资讯",
        })
      );
    }

    logger.info(`Initialized ${this.uploaders.size} platform uploaders`);
  }

  /**
   * 上传到单个平台
   */
  public async uploadToPlatform(
    platform: PlatformType,
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult> {
    const uploader = this.uploaders.get(platform);

    if (!uploader) {
      throw new AppError(
        ErrorType.VALIDATION_ERROR,
        `Platform ${platform} is not available or disabled`,
        ErrorHandler.createContext(
          "platform-upload-manager",
          "upload-to-platform",
          { platform, videoPath }
        )
      );
    }

    const mergedOptions = { ...this.defaultOptions, ...options };

    return ErrorHandler.executeWithRetry(
      () => uploader.upload(videoPath, mergedOptions, progressCallback),
      ErrorHandler.createContext(
        "platform-upload-manager",
        "upload-to-platform",
        { platform, videoPath }
      ),
      {
        maxAttempts: mergedOptions.maxRetries || 3,
        baseDelay: mergedOptions.retryDelay || 2000,
      }
    );
  }

  /**
   * 上传到所有可用平台
   */
  public async uploadToAllPlatforms(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const platforms = Array.from(this.uploaders.keys());

    logger.info(
      `Starting upload to ${platforms.length} platforms: ${platforms.join(
        ", "
      )}`
    );

    for (const platform of platforms) {
      try {
        logger.info(`Uploading to ${platform}`);

        const result = await this.uploadToPlatform(
          platform,
          videoPath,
          options,
          progressCallback
        );

        results.push(result);

        if (result.success) {
          logger.info(`Successfully uploaded to ${platform}`);
        } else {
          logger.error(`Failed to upload to ${platform}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Upload to ${platform} failed with exception: ${errorMessage}`
        );

        results.push({
          platform,
          success: false,
          message: `Upload failed with exception`,
          uploadTime: new Date(),
          duration: 0,
          error: errorMessage,
        });
      }
    }

    // 统计结果
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(`Upload summary: ${successful} successful, ${failed} failed`);

    return results;
  }

  /**
   * 并行上传到所有平台
   */
  public async uploadToAllPlatformsParallel(
    videoPath: string,
    options: UploadOptions,
    progressCallback?: UploadProgressCallback
  ): Promise<UploadResult[]> {
    const platforms = Array.from(this.uploaders.keys());

    logger.info(
      `Starting parallel upload to ${
        platforms.length
      } platforms: ${platforms.join(", ")}`
    );

    const uploadPromises = platforms.map((platform) =>
      this.uploadToPlatform(
        platform,
        videoPath,
        options,
        progressCallback
      ).catch(
        (error) =>
          ({
            platform,
            success: false,
            message: "Upload failed with exception",
            uploadTime: new Date(),
            duration: 0,
            error: error instanceof Error ? error.message : String(error),
          } as UploadResult)
      )
    );

    const results = await Promise.all(uploadPromises);

    // 统计结果
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    logger.info(
      `Parallel upload summary: ${successful} successful, ${failed} failed`
    );

    return results;
  }

  /**
   * 获取可用平台列表
   */
  public getAvailablePlatforms(): PlatformType[] {
    return Array.from(this.uploaders.keys());
  }

  /**
   * 检查平台是否可用
   */
  public isPlatformAvailable(platform: PlatformType): boolean {
    return this.uploaders.has(platform);
  }

  /**
   * 获取平台状态
   */
  public getPlatformStatus(): Record<PlatformType, boolean> {
    const status: Record<string, boolean> = {};

    for (const platform of Object.values(PlatformType)) {
      status[platform] = this.uploaders.has(platform);
    }

    return status as Record<PlatformType, boolean>;
  }

  /**
   * 根据布局推荐缩略图
   */
  public getRecommendedThumbnail(layout: LayoutType): string {
    switch (layout) {
      case "portrait":
        return "./assets/thumbnail-portrait.png";
      case "landscape":
        return "./assets/thumbnail-landscape.png";
      default:
        return "./assets/thumbnail-portrait.png";
    }
  }

  /**
   * 生成默认上传选项
   */
  public createUploadOptions(
    title: string,
    layout: LayoutType,
    customOptions: Partial<UploadOptions> = {}
  ): UploadOptions {
    return {
      title,
      tags: ["热点", "新闻", "资讯"],
      thumbnail: this.getRecommendedThumbnail(layout),
      description: `${title} - 每日全球热点新闻资讯`,
      category: "新闻资讯",
      ...this.defaultOptions,
      ...customOptions,
    };
  }

  /**
   * 验证上传前置条件
   */
  public async validatePrerequisites(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // 检查是否有可用平台
    if (this.uploaders.size === 0) {
      issues.push("No platforms are enabled or available");
    }

    // 检查账户文件
    for (const [platform, uploader] of this.uploaders) {
      const config = uploader["config"] as PlatformConfig;
      if (config.accountFile && !fs.existsSync(config.accountFile)) {
        issues.push(
          `Account file not found for ${platform}: ${config.accountFile}`
        );
      }
    }

    // 检查缩略图文件
    const thumbnails = [
      "./assets/thumbnail-portrait.png",
      "./assets/thumbnail-landscape.png",
    ];

    for (const thumbnail of thumbnails) {
      if (!fs.existsSync(thumbnail)) {
        issues.push(`Thumbnail file not found: ${thumbnail}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    this.uploaders.clear();
    logger.info("PlatformUploadManager cleanup completed");
  }
}

export default PlatformUploadManager;
