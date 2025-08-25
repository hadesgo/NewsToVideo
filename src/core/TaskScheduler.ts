import cron, { ScheduledTask, TaskContext } from 'node-cron'
import logger from '../lib/logger.ts'
import ErrorHandler, { ErrorType } from './ErrorHandler.ts'
import configManager from '../config/index.ts'

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * 任务信息接口
 */
export interface TaskInfo {
  id: string
  name: string
  description?: string
  status: TaskStatus
  startTime?: Date
  endTime?: Date
  duration?: number
  error?: string
  result?: any
}

/**
 * 任务执行函数类型
 */
export type TaskFunction = () => Promise<any>

/**
 * 任务配置接口
 */
export interface TaskConfig {
  id: string
  name: string
  description?: string
  cronExpression: string
  timezone?: string
  enabled: boolean
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

/**
 * 任务调度器
 */
export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private taskInfos: Map<string, TaskInfo> = new Map()
  private taskFunctions: Map<string, TaskFunction> = new Map()
  private taskConfigs: Map<string, TaskConfig> = new Map()

  /**
   * 注册任务
   */
  public registerTask(
    config: TaskConfig,
    taskFunction: TaskFunction
  ): void {
    if (this.tasks.has(config.id)) {
      throw new Error(`Task with id '${config.id}' already exists`)
    }

    this.taskConfigs.set(config.id, config)
    this.taskFunctions.set(config.id, taskFunction)
    this.taskInfos.set(config.id, {
      id: config.id,
      name: config.name,
      description: config.description,
      status: TaskStatus.PENDING,
    })

    logger.info(`Task registered: ${config.name} (${config.id})`)
  }

  /**
   * 启动任务
   */
  public startTask(taskId: string): void {
    const config = this.taskConfigs.get(taskId)
    const taskFunction = this.taskFunctions.get(taskId)

    if (!config || !taskFunction) {
      throw new Error(`Task '${taskId}' not found`)
    }

    if (!config.enabled) {
      logger.warn(`Task '${taskId}' is disabled, skipping start`)
      return
    }

    if (this.tasks.has(taskId)) {
      logger.warn(`Task '${taskId}' is already running`)
      return
    }

    const task = cron.schedule(
      config.cronExpression,
      async (ctx: TaskContext) => {
        await this.executeTask(taskId, ctx)
      },
      {
        timezone: config.timezone || configManager.getAppConfig().timezone,
      }
    )

    this.tasks.set(taskId, task)
    task.start()

    logger.info(`Task started: ${config.name} (${config.id}) with cron: ${config.cronExpression}`)
  }

  /**
   * 停止任务
   */
  public stopTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    const config = this.taskConfigs.get(taskId)

    if (!task || !config) {
      throw new Error(`Task '${taskId}' not found`)
    }

    task.stop()
    this.tasks.delete(taskId)

    // 更新任务状态
    const taskInfo = this.taskInfos.get(taskId)
    if (taskInfo && taskInfo.status === TaskStatus.RUNNING) {
      taskInfo.status = TaskStatus.CANCELLED
      taskInfo.endTime = new Date()
      if (taskInfo.startTime) {
        taskInfo.duration = taskInfo.endTime.getTime() - taskInfo.startTime.getTime()
      }
    }

    logger.info(`Task stopped: ${config.name} (${taskId})`)
  }

  /**
   * 启动所有已注册的任务
   */
  public startAllTasks(): void {
    for (const [taskId, config] of this.taskConfigs) {
      if (config.enabled) {
        try {
          this.startTask(taskId)
        }
        catch (error) {
          logger.error(`Failed to start task '${taskId}': ${error}`)
        }
      }
    }
  }

  /**
   * 停止所有任务
   */
  public stopAllTasks(): void {
    for (const taskId of this.tasks.keys()) {
      try {
        this.stopTask(taskId)
      }
      catch (error) {
        logger.error(`Failed to stop task '${taskId}': ${error}`)
      }
    }
  }

  /**
   * 手动执行任务
   */
  public async executeTaskManually(taskId: string): Promise<any> {
    const taskFunction = this.taskFunctions.get(taskId)
    const config = this.taskConfigs.get(taskId)

    if (!taskFunction || !config) {
      throw new Error(`Task '${taskId}' not found`)
    }

    logger.info(`Manually executing task: ${config.name} (${taskId})`)
    
    const context: TaskContext = {
      task: {
        getStatus: async () => 'manual',
      } as any,
      triggeredAt: new Date(),
      dateLocalIso: new Date().toISOString(),
      date: new Date(),
    }

    return this.executeTask(taskId, context)
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string, context: TaskContext): Promise<any> {
    const taskFunction = this.taskFunctions.get(taskId)
    const config = this.taskConfigs.get(taskId)
    const taskInfo = this.taskInfos.get(taskId)

    if (!taskFunction || !config || !taskInfo) {
      throw new Error(`Task '${taskId}' not found`)
    }

    // 检查是否已经在运行
    if (taskInfo.status === TaskStatus.RUNNING) {
      logger.warn(`Task '${taskId}' is already running, skipping`)
      return
    }

    // 更新任务状态
    taskInfo.status = TaskStatus.RUNNING
    taskInfo.startTime = new Date()
    taskInfo.endTime = undefined
    taskInfo.duration = undefined
    taskInfo.error = undefined
    taskInfo.result = undefined

    logger.info(`Task started: ${config.name} (${taskId}) at ${context.triggeredAt.toISOString()}`)

    try {
      // 使用错误处理器执行任务
      const result = await ErrorHandler.executeWithRetry(
        () => this.executeWithTimeout(taskFunction, config.timeout),
        ErrorHandler.createContext(`task-${taskId}`, config.name),
        {
          maxAttempts: config.maxRetries || configManager.getAppConfig().maxRetryCount,
          baseDelay: config.retryDelay || 1000,
        }
      )

      // 任务成功完成
      taskInfo.status = TaskStatus.COMPLETED
      taskInfo.result = result
      taskInfo.endTime = new Date()
      taskInfo.duration = taskInfo.endTime.getTime() - taskInfo.startTime!.getTime()

      logger.info(`Task completed: ${config.name} (${taskId}) in ${taskInfo.duration}ms`)
      return result
    }
    catch (error) {
      // 任务执行失败
      taskInfo.status = TaskStatus.FAILED
      taskInfo.error = error instanceof Error ? error.message : String(error)
      taskInfo.endTime = new Date()
      taskInfo.duration = taskInfo.endTime.getTime() - taskInfo.startTime!.getTime()

      logger.error(`Task failed: ${config.name} (${taskId}) after ${taskInfo.duration}ms - ${taskInfo.error}`)

      // 使用错误处理器处理错误
      await ErrorHandler.handle(
        error,
        ErrorHandler.createContext(`task-${taskId}`, config.name, {
          taskId,
          triggeredAt: context.triggeredAt,
          duration: taskInfo.duration,
        })
      )

      throw error
    }
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout(
    taskFunction: TaskFunction,
    timeout?: number
  ): Promise<any> {
    if (!timeout) {
      return taskFunction()
    }

    return Promise.race([
      taskFunction(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task timeout after ${timeout}ms`))
        }, timeout)
      }),
    ])
  }

  /**
   * 获取任务信息
   */
  public getTaskInfo(taskId: string): TaskInfo | undefined {
    return this.taskInfos.get(taskId)
  }

  /**
   * 获取所有任务信息
   */
  public getAllTaskInfos(): TaskInfo[] {
    return Array.from(this.taskInfos.values())
  }

  /**
   * 获取运行中的任务
   */
  public getRunningTasks(): TaskInfo[] {
    return Array.from(this.taskInfos.values()).filter(
      info => info.status === TaskStatus.RUNNING
    )
  }

  /**
   * 检查任务是否存在
   */
  public hasTask(taskId: string): boolean {
    return this.taskConfigs.has(taskId)
  }

  /**
   * 检查任务是否正在运行
   */
  public isTaskRunning(taskId: string): boolean {
    const taskInfo = this.taskInfos.get(taskId)
    return taskInfo?.status === TaskStatus.RUNNING || false
  }

  /**
   * 更新任务配置
   */
  public updateTaskConfig(taskId: string, updates: Partial<TaskConfig>): void {
    const config = this.taskConfigs.get(taskId)
    if (!config) {
      throw new Error(`Task '${taskId}' not found`)
    }

    const wasRunning = this.tasks.has(taskId)
    
    if (wasRunning) {
      this.stopTask(taskId)
    }

    const newConfig = { ...config, ...updates }
    this.taskConfigs.set(taskId, newConfig)

    if (wasRunning && newConfig.enabled) {
      this.startTask(taskId)
    }

    logger.info(`Task config updated: ${taskId}`)
  }

  /**
   * 获取任务统计信息
   */
  public getTaskStats(): {
    total: number
    running: number
    completed: number
    failed: number
    pending: number
  } {
    const infos = Array.from(this.taskInfos.values())
    
    return {
      total: infos.length,
      running: infos.filter(info => info.status === TaskStatus.RUNNING).length,
      completed: infos.filter(info => info.status === TaskStatus.COMPLETED).length,
      failed: infos.filter(info => info.status === TaskStatus.FAILED).length,
      pending: infos.filter(info => info.status === TaskStatus.PENDING).length,
    }
  }

  /**
   * 清理已完成的任务历史
   */
  public cleanupCompletedTasks(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
    
    for (const [taskId, taskInfo] of this.taskInfos) {
      if (
        taskInfo.status === TaskStatus.COMPLETED &&
        taskInfo.endTime &&
        taskInfo.endTime < cutoffTime
      ) {
        // 重置为 PENDING 状态，保留配置
        taskInfo.status = TaskStatus.PENDING
        taskInfo.startTime = undefined
        taskInfo.endTime = undefined
        taskInfo.duration = undefined
        taskInfo.error = undefined
        taskInfo.result = undefined
      }
    }

    logger.info(`Cleaned up completed tasks older than ${olderThanHours} hours`)
  }
}

// 导出单例实例
export const taskScheduler = new TaskScheduler()
export default taskScheduler