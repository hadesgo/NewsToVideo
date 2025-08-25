import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/index.ts', // 主入口文件，难以测试
        'src/lib/douyin.ts', // 外部平台集成，需要mock
        'src/lib/bilibili.ts',
        'src/lib/tencent.ts',
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
    testTimeout: 30000, // 30秒超时
    hookTimeout: 10000, // 10秒钩子超时
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})