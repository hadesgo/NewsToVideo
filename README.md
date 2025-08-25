# NewsToVideo

将全球热点新闻自动转化为视频内容的智能工具

## 🎆 项目介绍

NewsToVideo 是一个全自动化的新闻视频生成系统，能够：

- 📰 **自动抓取热点新闻**：使用AI获取全球最新热点新闻
- 🎧 **文字转语音**：通过腾讯云TTS服务生成高质量语音
- 🎥 **视频合成**：自动合成包含文字、背景、语音的完整视频
- 🖼️ **素材获取**：从 Pexels 等平台获取相关图片和视频素材
- 🚀 **多平台发布**：支持同时发布到 B站、抖音、腾讯视频号等平台

## 🏠 系统架构

重构后的系统采用模块化设计，主要由以下模块组成：

### 🛠️ 核心模块

- **ConfigManager** (`src/config/`)：统一配置管理，支持环境变量和配置验证
- **ErrorHandler** (`src/core/ErrorHandler.ts`)：统一错误处理和重试机制
- **TaskScheduler** (`src/core/TaskScheduler.ts`)：任务调度和定时执行
- **NewsProcessor** (`src/core/NewsProcessor.ts`)：新闻获取和处理
- **VideoGenerator** (`src/core/VideoGenerator.ts`)：视频生成和合成
- **PlatformUploadManager** (`src/core/PlatformUploadManager.ts`)：多平台上传管理

### 📁 目录结构

```
src/
├── config/                 # 配置管理
├── core/                   # 核心业务模块
├── lib/                    # 基础功能库
├── material/               # 素材获取
├── utils/                  # 工具函数
├── __tests__/              # 测试文件
├── constant.ts             # 常量定义
├── index.ts                # 应用入口
└── type.ts                 # 类型定义
```

## 🚀 快速开始

### 前置条件

- Node.js >= 18.x
- npm / yarn / pnpm
- 腾讯云 TTS 服务账号
- 通义千问 API 密钥
- Pexels API 密钥（可选）

### 安装依赖

```bash
npm install
```

### 环境配置

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，填入真实的配置值：

```env
# API 配置
QWEN_API_KEY=your_qwen_api_key_here
TENCENT_SECRET_ID=your_tencent_secret_id
TENCENT_SECRET_KEY=your_tencent_secret_key

# 邮件通知配置
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
EMAIL_TO=recipient@example.com

# 其他配置请参考 .env.example
```

### 运行项目

```bash
# 生产环境运行
npm run start

# 开发环境运行（支持热重载）
npm run dev
```

## 🧪 测试

项目采用 Vitest 作为测试框架，提供完整的测试覆盖：

```bash
# 运行测试
npm run test

# 运行测试（一次性）
npm run test:run

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式运行测试
npm run test:watch

# 使用 UI 界面运行测试
npm run test:ui
```

## 📝 开发指南

### 代码规范

```bash
# 代码检查
npm run lint

# 自动修复代码风格问题
npm run lint:fix

# TypeScript 类型检查
npm run type-check
```

### 构建项目

```bash
# 构建 TypeScript 项目
npm run build

# 清理构建产物
npm run clean
```

## 🛡️ 错误处理

系统内置了完善的错误处理机制：

- **自动重试**：支持指数退避策略
- **错误分类**：区分网络、API、文件等不同类型错误
- **日志记录**：详细的错误日志和邮件通知
- **优雅降级**：单个模块失败不会影响整体流程

## 📊 监控与日志

- **日志轮转**：支持按日志轮转，自动清理旧日志
- **邮件通知**：任务成功/失败都会发送邮件通知
- **进度跟踪**：实时跟踪任务执行进度

## 💼 部署

### Docker 部署（推荐）

```dockerfile
# 创建 Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start src/index.ts --name "newstovideo" --interpreter tsx

# 查看状态
pm2 status

# 查看日志
pm2 logs newstovideo
```

## 📈 性能优化

### 已实现的优化

- **并发处理**：支持多平台并发上传
- **文件缓存**：已存在的文件不会重复生成
- **内存管理**：及时清理临时文件和资源
- **错误重试**：智能重试机制减少失败率

### 调优建议

- 根据服务器性能调整 `MAX_RETRY_COUNT`
- 配置适合的 `VIDEO_FPS` 和视频质量
- 定期清理 `./out/` 目录下的旧文件

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/AmazingFeature`
3. 提交修改：`git commit -m 'Add some AmazingFeature'`
4. 推送分支：`git push origin feature/AmazingFeature`
5. 创建 Pull Request

### 开发流程

1. 确保所有测试通过：`npm run test`
2. 检查代码规范：`npm run lint`
3. 验证类型检查：`npm run type-check`
4. 更新文档（如需要）

## 📝 变更日志

### v2.0.0 - 2024-12-25

**🎆 重大重构**
- 全面重构为模块化架构
- 新增统一配置管理系统
- 实现完善的错误处理机制
- 添加完整的单元测试套件
- 优化任务调度和管理
- 新增多平台并发上传支持

## 📄 许可证

本项目仅供学习和研究使用。

## 🤝 支持

如果您在使用过程中遇到问题，请：

1. 查看 [Issues](../../issues) 中是否有类似问题
2. 检查日志文件：`./logs/`
3. 验证配置文件：`.env`
4. 提交 Issue 并附上相关日志

---

❤️ **如果这个项目对您有帮助，请给个 Star 支持一下！**
