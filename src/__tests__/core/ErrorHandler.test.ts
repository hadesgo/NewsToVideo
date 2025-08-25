import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AxiosError } from 'axios'
import ErrorHandler, { AppError, ErrorType } from '../../core/ErrorHandler.ts'
import { TestAssertions, MockUtils } from '../utils/test-helpers.ts'

// Mock dependencies
vi.mock('../../lib/logger.ts', () => ({
  default: MockUtils.mockLogger(),
}))

vi.mock('../../lib/email.ts', () => ({
  sendMail: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../config/index.ts', () => ({
  default: {
    getAppConfig: () => ({
      maxRetryCount: 3,
    }),
  },
}))

describe('ErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const context = ErrorHandler.createContext('test-operation', 'test-step')
      const error = new AppError(
        ErrorType.VALIDATION_ERROR,
        'Test error message',
        context,
        true
      )

      expect(error.name).toBe('AppError')
      expect(error.type).toBe(ErrorType.VALIDATION_ERROR)
      expect(error.message).toBe('Test error message')
      expect(error.isRetryable).toBe(true)
      expect(error.context).toBe(context)
    })
  })

  describe('Error Context', () => {
    it('should create error context with timestamp', () => {
      const context = ErrorHandler.createContext('test-operation', 'test-step', { key: 'value' })

      expect(context.operation).toBe('test-operation')
      expect(context.step).toBe('test-step')
      expect(context.data).toEqual({ key: 'value' })
      expect(context.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('Error Analysis', () => {
    it('should analyze AxiosError correctly', async () => {
      const axiosError = new AxiosError('Network error')
      axiosError.response = {
        status: 500,
        data: { error: 'Server error' },
      } as any

      const context = ErrorHandler.createContext('test', 'axios-test')
      const result = await ErrorHandler.handle(axiosError, context)

      expect(result.success).toBe(false)
      expect(result.errorType).toBe(ErrorType.API_ERROR)
      expect(result.shouldRetry).toBe(true)
    })

    it('should analyze network errors as retryable', async () => {
      const networkError = new Error('ECONNREFUSED')
      const context = ErrorHandler.createContext('test', 'network-test')
      
      const result = await ErrorHandler.handle(networkError, context)

      expect(result.shouldRetry).toBe(true)
      expect(result.errorType).toBe(ErrorType.NETWORK_ERROR)
    })

    it('should analyze file errors as non-retryable', async () => {
      const fileError = new Error('ENOENT: no such file or directory')
      const context = ErrorHandler.createContext('test', 'file-test')
      
      const result = await ErrorHandler.handle(fileError, context)

      expect(result.shouldRetry).toBe(false)
      expect(result.errorType).toBe(ErrorType.FILE_ERROR)
    })

    it('should handle AppError correctly', async () => {
      const context = ErrorHandler.createContext('test', 'app-error-test')
      const appError = new AppError(
        ErrorType.PROCESSING_ERROR,
        'Processing failed',
        context,
        true
      )
      
      const result = await ErrorHandler.handle(appError, context)

      expect(result.errorType).toBe(ErrorType.PROCESSING_ERROR)
      expect(result.shouldRetry).toBe(true)
    })
  })

  describe('Retry Logic', () => {
    it('should calculate retry delay correctly', () => {
      const config = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      }

      const delay1 = ErrorHandler.calculateRetryDelay(1, config)
      const delay2 = ErrorHandler.calculateRetryDelay(2, config)
      const delay3 = ErrorHandler.calculateRetryDelay(3, config)

      expect(delay1).toBeGreaterThanOrEqual(1000)
      expect(delay1).toBeLessThanOrEqual(1100) // 包含抖动
      expect(delay2).toBeGreaterThanOrEqual(2000)
      expect(delay2).toBeLessThanOrEqual(2200)
      expect(delay3).toBeGreaterThanOrEqual(4000)
      expect(delay3).toBeLessThanOrEqual(4400)
    })

    it('should respect maximum delay', () => {
      const config = {
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      }

      const delay = ErrorHandler.calculateRetryDelay(10, config)
      expect(delay).toBeLessThanOrEqual(5500) // maxDelay + jitter
    })
  })

  describe('Execute with Retry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      const context = ErrorHandler.createContext('test', 'retry-test')

      const result = await ErrorHandler.executeWithRetry(mockOperation, context)

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const context = ErrorHandler.createContext('test', 'retry-test')

      const result = await ErrorHandler.executeWithRetry(
        mockOperation,
        context,
        { maxAttempts: 3, baseDelay: 10 }
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should fail after max attempts', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      const context = ErrorHandler.createContext('test', 'retry-test')

      await TestAssertions.assertAsyncThrows(
        () => ErrorHandler.executeWithRetry(
          mockOperation,
          context,
          { maxAttempts: 2, baseDelay: 10 }
        ),
        'Persistent failure'
      )

      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const fileError = new Error('ENOENT: file not found')
      const mockOperation = vi.fn().mockRejectedValue(fileError)
      const context = ErrorHandler.createContext('test', 'non-retryable-test')

      await TestAssertions.assertAsyncThrows(
        () => ErrorHandler.executeWithRetry(mockOperation, context),
        'ENOENT: file not found'
      )

      expect(mockOperation).toHaveBeenCalledTimes(1) // 不应该重试
    })
  })

  describe('Function Wrapping', () => {
    it('should wrap function with error handling', async () => {
      const originalFunction = vi.fn().mockResolvedValue('wrapped result')
      const wrappedFunction = ErrorHandler.wrap(
        originalFunction,
        'test-operation'
      )

      const result = await wrappedFunction('arg1', 'arg2')

      expect(result).toBe('wrapped result')
      expect(originalFunction).toHaveBeenCalledWith('arg1', 'arg2')
    })

    it('should handle errors in wrapped function', async () => {
      const error = new Error('Wrapped function error')
      const originalFunction = vi.fn().mockRejectedValue(error)
      const wrappedFunction = ErrorHandler.wrap(
        originalFunction,
        'test-operation',
        { maxAttempts: 1 }
      )

      await TestAssertions.assertAsyncThrows(
        () => wrappedFunction(),
        'Wrapped function error'
      )
    })
  })

  describe('Error Types', () => {
    it('should categorize different error types', () => {
      const errorTypes = Object.values(ErrorType)
      
      expect(errorTypes).toContain(ErrorType.NETWORK_ERROR)
      expect(errorTypes).toContain(ErrorType.API_ERROR)
      expect(errorTypes).toContain(ErrorType.FILE_ERROR)
      expect(errorTypes).toContain(ErrorType.PROCESSING_ERROR)
      expect(errorTypes).toContain(ErrorType.VALIDATION_ERROR)
      expect(errorTypes).toContain(ErrorType.PLATFORM_ERROR)
      expect(errorTypes).toContain(ErrorType.UNKNOWN_ERROR)
    })
  })

  describe('HTTP Status Code Handling', () => {
    it('should handle 4xx errors as non-retryable', async () => {
      const axiosError = new AxiosError('Bad Request')
      axiosError.response = { status: 400 } as any

      const context = ErrorHandler.createContext('test', 'http-test')
      const result = await ErrorHandler.handle(axiosError, context)

      expect(result.shouldRetry).toBe(false)
    })

    it('should handle 5xx errors as retryable', async () => {
      const axiosError = new AxiosError('Internal Server Error')
      axiosError.response = { status: 500 } as any

      const context = ErrorHandler.createContext('test', 'http-test')
      const result = await ErrorHandler.handle(axiosError, context)

      expect(result.shouldRetry).toBe(true)
    })

    it('should handle 429 (rate limit) as retryable', async () => {
      const axiosError = new AxiosError('Too Many Requests')
      axiosError.response = { status: 429 } as any

      const context = ErrorHandler.createContext('test', 'http-test')
      const result = await ErrorHandler.handle(axiosError, context)

      expect(result.shouldRetry).toBe(true)
    })
  })
})