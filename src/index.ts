import "dotenv/config";
import logger from "./lib/logger.ts";
import { sendMail } from "./lib/email.ts";
import configManager from "./config/index.ts";
import taskScheduler from "./core/TaskScheduler.ts";
import NewsProcessor from "./core/NewsProcessor.ts";
import VideoGenerator from "./core/VideoGenerator.ts";
import PlatformUploadManager from "./core/PlatformUploadManager.ts";
import ErrorHandler, { ErrorType } from "./core/ErrorHandler.ts";

/**
 * 主要业务流程：生成新闻视频并上传
 */
async function generateNewsVideoAndUpload(): Promise<void> {
  logger.info("Starting news video generation and upload process");

  let newsProcessor: NewsProcessor | undefined;
  let uploadManager: PlatformUploadManager | undefined;

  try {
    // 1. 初始化处理器
    newsProcessor = new NewsProcessor();
    uploadManager = new PlatformUploadManager();

    // 2. 验证上传前置条件
    const prerequisites = await uploadManager.validatePrerequisites();
    if (!prerequisites.valid) {
      throw new Error(
        `Upload prerequisites not met: ${prerequisites.issues.join(", ")}`
      );
    }

    // 3. 处理新闻并生成配置
    logger.info("Processing news and generating configurations");
    const { newsList, configs } = await newsProcessor.processAllNews(
      (step, progress, total) => {
        logger.info(`News processing: ${step} (${progress}/${total})`);
      }
    );

    const videoName = newsProcessor.getVideoName();
    const outputDir = newsProcessor.getOutputDir();

    // 4. 为每种布局生成视频并上传
    const layouts = configManager.getVideoConfig().layouts;

    for (const layout of layouts) {
      const config = configs.get(layout);
      if (!config) {
        logger.warn(`No configuration found for layout: ${layout}`);
        continue;
      }

      logger.info(`Generating video for layout: ${layout}`);

      // 生成视频
      const videoPath = `${outputDir}/${layout}/${videoName}.mp4`;
      const videoGenerator = new VideoGenerator(config, videoPath);

      const result = await videoGenerator.generateVideo((step, progress) => {
        logger.info(`Video generation (${layout}): ${step} (${progress}%)`);
      });

      if (!result.success) {
        throw new Error(`Video generation failed for layout: ${layout}`);
      }

      logger.info(
        `Video generated successfully: ${videoPath} (${result.fileSize} bytes)`
      );

      // 创建上传选项
      const uploadOptions = uploadManager.createUploadOptions(
        videoName,
        layout
      );

      // 上传到所有平台
      logger.info(`Uploading video to all platforms: ${layout}`);
      const uploadResults = await uploadManager.uploadToAllPlatforms(
        videoPath,
        uploadOptions,
        (platform, progress, message) => {
          logger.info(
            `Upload progress (${platform}): ${message} (${progress}%)`
          );
        }
      );

      // 记录上传结果
      for (const uploadResult of uploadResults) {
        if (uploadResult.success) {
          logger.info(`Successfully uploaded to ${uploadResult.platform}`);
        } else {
          logger.error(
            `Failed to upload to ${uploadResult.platform}: ${uploadResult.error}`
          );
        }
      }

      // 检查是否所有上传都成功
      const failedUploads = uploadResults.filter((r) => !r.success);
      if (failedUploads.length > 0) {
        const failedPlatforms = failedUploads.map((r) => r.platform).join(", ");
        logger.warn(
          `Some uploads failed for layout ${layout}: ${failedPlatforms}`
        );
      }

      // 清理视频生成器
      await videoGenerator.cleanup();
    }

    logger.info(
      "News video generation and upload process completed successfully"
    );

    // 发送成功通知
    await sendMail(
      "🥳视频发布成功",
      `视频发布成功！\n\n处理的新闻数量: ${
        newsList.length
      }\n生成的布局: ${layouts.join(", ")}\n\n🎉🎉🎉🎉🎉🎉`
    );
  } catch (error) {
    logger.error(`News video generation and upload failed: ${error}`);

    // 使用统一的错误处理
    await ErrorHandler.handle(
      error,
      ErrorHandler.createContext("main-process", "generate-and-upload"),
      { maxAttempts: 1 } // 主流程不重试
    );

    // 发送失败通知
    let errorMessage = "";
    if (error instanceof Error) {
      errorMessage = `${error.message}\n${error.stack}`;
    } else {
      errorMessage = String(error);
    }

    await sendMail(
      "😢视频发布失败",
      `视频发布失败！\n\n错误信息:\n${errorMessage}`
    );

    throw error;
  } finally {
    // 清理资源
    if (newsProcessor) {
      await newsProcessor.cleanup();
    }
    if (uploadManager) {
      await uploadManager.cleanup();
    }
  }
}

/**
 * 应用程序入口
 */
async function main(): Promise<void> {
  try {
    // 验证配置
    if (!configManager.isConfigured()) {
      throw new Error(
        "Application configuration is invalid. Please check your .env file."
      );
    }

    logger.info("NewsToVideo application starting");
    logger.info(
      `Configuration loaded: ${JSON.stringify(
        {
          platforms: configManager.getPlatformConfig(),
          videoLayouts: configManager.getVideoConfig().layouts,
          cronSchedule: configManager.getAppConfig().cronSchedule,
        },
        null,
        2
      )}`
    );

    // 注册主要任务
    taskScheduler.registerTask(
      {
        id: "news-video-generation",
        name: "News Video Generation and Upload",
        description:
          "Generate news videos and upload to all configured platforms",
        cronExpression: configManager.getAppConfig().cronSchedule,
        timezone: configManager.getAppConfig().timezone,
        enabled: true,
        maxRetries: 1, // 主任务不重试，内部模块会处理重试
        timeout: 120 * 60 * 1000, // 120分钟超时
      },
      generateNewsVideoAndUpload
    );

    // 启动所有任务
    taskScheduler.startAllTasks();

    logger.info("NewsToVideo application started successfully");
    logger.info(
      `Next execution scheduled: ${configManager.getAppConfig().cronSchedule}`
    );

    // 保持应用运行
    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, shutting down gracefully");
      taskScheduler.stopAllTasks();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM, shutting down gracefully");
      taskScheduler.stopAllTasks();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Application startup failed: ${error}`);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
