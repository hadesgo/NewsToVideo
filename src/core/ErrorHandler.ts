import { AxiosError } from "axios";
import logger from "../lib/logger.ts";
import { sendMail } from "../lib/email.ts";
import configManager from "../config/index.ts";

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  FILE_ERROR = "FILE_ERROR",
  PROCESSING_ERROR = "PROCESSING_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  PLATFORM_ERROR = "PLATFORM_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  operation: string;
  step?: string;
  data?: Record<string, any>;
  timestamp: Date;
}

/**
 * 处理结果
 */
export interface HandleResult {
  success: boolean;
  shouldRetry: boolean;
  retryDelay?: number;
  errorType: ErrorType;
  message: string;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * 应用级错误类
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;

  constructor(
    type: ErrorType,
    message: string,
    context: ErrorContext,
    isRetryable: boolean = false,
    cause?: Error
  ) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.context = context;
    this.isRetryable = isRetryable;
    this.cause = cause;
  }
}

/**
 * 统一错误处理器
 */
export class ErrorHandler {
  private static readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: configManager.getAppConfig().maxRetryCount,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  /**
   * 处理错误
   */
  static async handle(
    error: unknown,
    context: ErrorContext,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<HandleResult> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    const errorInfo = this.analyzeError(error, context);

    // 记录错误日志
    await this.logError(errorInfo, context);

    // 发送关键错误通知
    if (this.isCriticalError(errorInfo.errorType)) {
      await this.sendErrorNotification(errorInfo, context);
    }

    return {
      success: false,
      shouldRetry: errorInfo.isRetryable && config.maxAttempts > 0,
      retryDelay: this.calculateRetryDelay(1, config),
      errorType: errorInfo.errorType,
      message: errorInfo.message,
    };
  }

  /**
   * 分析错误类型和属性
   */
  private static analyzeError(error: unknown, context: ErrorContext) {
    if (error instanceof AppError) {
      return {
        errorType: error.type,
        message: error.message,
        isRetryable: error.isRetryable,
        originalError: error,
      };
    }

    if (error instanceof AxiosError) {
      return this.analyzeAxiosError(error);
    }

    if (error instanceof Error) {
      return this.analyzeGenericError(error, context);
    }

    return {
      errorType: ErrorType.UNKNOWN_ERROR,
      message: String(error),
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * 分析 Axios 错误
   */
  private static analyzeAxiosError(error: AxiosError) {
    const status = error.response?.status;

    if (!status) {
      return {
        errorType: ErrorType.NETWORK_ERROR,
        message: `Network error: ${error.message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    if (status >= 500) {
      return {
        errorType: ErrorType.API_ERROR,
        message: `Server error (${status}): ${error.message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    if (status === 429) {
      return {
        errorType: ErrorType.API_ERROR,
        message: `Rate limit exceeded: ${error.message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    if (status >= 400) {
      return {
        errorType: ErrorType.API_ERROR,
        message: `Client error (${status}): ${error.message}`,
        isRetryable: false,
        originalError: error,
      };
    }

    return {
      errorType: ErrorType.API_ERROR,
      message: `API error (${status}): ${error.message}`,
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * 分析通用错误
   */
  private static analyzeGenericError(error: Error, context: ErrorContext) {
    const message = error.message.toLowerCase();

    if (
      message.includes("enoent") ||
      message.includes("file") ||
      message.includes("directory")
    ) {
      return {
        errorType: ErrorType.FILE_ERROR,
        message: `File system error: ${error.message}`,
        isRetryable: false,
        originalError: error,
      };
    }

    if (message.includes("timeout") || message.includes("connection")) {
      return {
        errorType: ErrorType.NETWORK_ERROR,
        message: `Network timeout: ${error.message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    if (
      context.operation.includes("video") ||
      context.operation.includes("audio")
    ) {
      return {
        errorType: ErrorType.PROCESSING_ERROR,
        message: `Processing error: ${error.message}`,
        isRetryable: true,
        originalError: error,
      };
    }

    return {
      errorType: ErrorType.UNKNOWN_ERROR,
      message: error.message,
      isRetryable: false,
      originalError: error,
    };
  }

  /**
   * 记录错误日志
   */
  private static async logError(
    errorInfo: any,
    context: ErrorContext
  ): Promise<void> {
    const logData = {
      type: errorInfo.errorType,
      message: errorInfo.message,
      operation: context.operation,
      step: context.step,
      timestamp: context.timestamp.toISOString(),
      data: context.data,
      stack: errorInfo.originalError?.stack,
    };

    logger.error(`Error occurred: ${JSON.stringify(logData)}`);
  }

  /**
   * 发送错误通知
   */
  private static async sendErrorNotification(
    errorInfo: any,
    context: ErrorContext
  ): Promise<void> {
    try {
      const subject = `🚨 NewsToVideo Error: ${errorInfo.errorType}`;
      const body = `
操作: ${context.operation}
步骤: ${context.step || "N/A"}
错误类型: ${errorInfo.errorType}
错误信息: ${errorInfo.message}
时间: ${context.timestamp.toISOString()}
数据: ${JSON.stringify(context.data, null, 2)}

堆栈信息:
${errorInfo.originalError?.stack || "N/A"}
      `;
      await sendMail(subject, body);
    } catch (notificationError) {
      logger.error(`Failed to send error notification: ${notificationError}`);
    }
  }

  /**
   * 判断是否为关键错误
   */
  private static isCriticalError(errorType: ErrorType): boolean {
    return [
      ErrorType.API_ERROR,
      ErrorType.PLATFORM_ERROR,
      ErrorType.PROCESSING_ERROR,
    ].includes(errorType);
  }

  /**
   * 计算重试延迟
   */
  static calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    // 添加随机抖动，避免惊群效应
    const jitter = delay * 0.1 * Math.random();
    return Math.floor(delay + jitter);
  }

  /**
   * 执行带重试的操作
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    retryConfig: Partial<RetryConfig> = {}
  ): Promise<T> {
    const config = { ...this.defaultRetryConfig, ...retryConfig };
    let lastError: unknown;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const result = await this.handle(
          error,
          {
            ...context,
            step: `${context.step} (attempt ${attempt}/${config.maxAttempts})`,
          },
          config
        );

        if (!result.shouldRetry || attempt === config.maxAttempts) {
          throw error;
        }

        const delay = this.calculateRetryDelay(attempt, config);
        logger.info(
          `Retrying operation after ${delay}ms (attempt ${attempt + 1}/${
            config.maxAttempts
          })`
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 睡眠函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 创建错误上下文
   */
  static createContext(
    operation: string,
    step?: string,
    data?: Record<string, any>
  ): ErrorContext {
    return {
      operation,
      step,
      data,
      timestamp: new Date(),
    };
  }

  /**
   * 包装函数，自动处理错误
   */
  static wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    operation: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    return async (...args: T): Promise<R> => {
      const context = this.createContext(operation);
      return this.executeWithRetry(() => fn(...args), context, retryConfig);
    };
  }
}

export default ErrorHandler;
