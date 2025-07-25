import fs from 'fs'
import path from 'path'
import { AxiosError } from 'axios'
import cron, { TaskContext } from 'node-cron'
import stringify from 'safe-stable-stringify'
import 'dotenv/config'

import { NewsVideoConfig, LayoutType } from './type.ts'
import news from './lib/news.ts'
import tts from './lib/tts.ts'
import genImage from './material/image.ts'
import genVideo from './lib/video.ts'
import { getVideoDurationInSeconds } from './utils/ffmpeg.ts'
import getVideo from './material/video.ts'
import { saveConfig, genTalkVideo } from './utils/utils.ts'
import { DouYinVideo } from './lib/douyin.ts'
import { BilibiliVideo } from './lib/bilibili.ts'
import logger from './lib/logger.ts'
import { sendMail } from './lib/email.ts'
import { TencentVideo } from './lib/tencent.ts'

const videoLayouts = ['portrait']

function formatTime(date: Date): string[] {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return [`${year}-${month}-${day}`, `${year}年${month}月${day}日`]
}

const genNewsVideoAndUpload = async () => {
  const formatTodays = formatTime(new Date())
  const today = formatTodays[0]
  const videoName = `每日全球热点新闻资讯-${formatTodays[1]}`

  const todayDir = `./out/${today}`
  fs.mkdirSync(todayDir, { recursive: true })

  const aduioDir = path.join(todayDir, 'audio')
  fs.mkdirSync(aduioDir, { recursive: true })

  const talkVideolDir = path.join(todayDir, 'talk-video')
  fs.mkdirSync(talkVideolDir, { recursive: true })

  const newsJsonFilePath = path.join(todayDir, 'news.json')
  let newsList = []
  if (fs.existsSync(newsJsonFilePath)) {
    newsList = JSON.parse(fs.readFileSync(newsJsonFilePath, 'utf-8'))
  }
  else {
    newsList = await news(formatTodays[1])
    fs.writeFileSync(newsJsonFilePath, JSON.stringify(newsList))
  }
  logger.info(`[main] 获取到 ${newsList.length} 条新闻`)

  for (let i = 0; i < videoLayouts.length; i++) {
    const layout = videoLayouts[i]
    let width = 0
    let height = 0
    switch (layout) {
      case 'landscape':
      {
        width = 1920
        height = 1080
        break
      }
      case 'portrait':
      {
        width = 1080
        height = 1920
        break
      }
      default:
        break
    }

    let videoConfig: NewsVideoConfig = { layers: [], layout: layout as LayoutType }
    if (fs.existsSync(path.join(todayDir, layout, 'config.json'))) {
      videoConfig = JSON.parse(fs.readFileSync(path.join(todayDir, layout, 'config.json'), 'utf-8'))
    }

    const materialDir = path.join(todayDir, layout, 'materia')
    fs.mkdirSync(materialDir, { recursive: true })

    const configPath = path.join(todayDir, layout, 'config.json')

    for (let j = 0; j < newsList.length; j++) {
      let layer = {} as NewsVideoConfig['layers'][number]
      if (videoConfig.layers.length > j) {
        layer = videoConfig.layers[j]
      }
      else {
        videoConfig.layers.push(layer)
      }

      // 生成视频配置
      const news = newsList[j]
      layer.news = { title: news.title, content: news.content, keywodrs: news.keywords }
      saveConfig(videoConfig, configPath)

      // 生成音频
      const audioPath = path.join(aduioDir, `${j}.mp3`)
      const subtitleFilePath = path.join(aduioDir, `${j}.json`)
      if (layer?.audio?.path == null) {
        const audioInfo = await tts(news.content, audioPath)
        if (audioInfo.subtitles) {
          fs.writeFileSync(subtitleFilePath, JSON.stringify(audioInfo.subtitles))
        }
        layer.audio = { path: audioInfo.audio, subtitles: audioInfo.subtitles }
        layer.duration = await getVideoDurationInSeconds(audioInfo.audio)
      }
      logger.info(`[main] 音频 ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
      saveConfig(videoConfig, configPath)

      // 下载视频素材
      if (layer?.material?.path == null) {
        const videoPath = await getVideo(news.keywords, layout, layer.duration, materialDir, j)
        if (videoPath) {
          layer.material = { path: videoPath, type: 'video' }
          logger.info(`[main] video ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
        }
        else {
          // 生成图片
          const imagePath = path.join(materialDir, `${j}.png`)
          if (!fs.existsSync(imagePath)) {
            await genImage(news.keywords, `${width}x${height}`, imagePath)
          }
          layer.material = { path: imagePath, type: 'image' }
          logger.info(`[main] image ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
        }
      }
      else {
        logger.info(`[main] ${layer.material.type} ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
      }
      saveConfig(videoConfig, configPath)
    }
    for (let k = 0; k < videoConfig.layers.length; k++) {
      const layer = videoConfig.layers[k]
      const talkVideoPath = path.join(talkVideolDir, `${k}.mp4`)
      await genTalkVideo(layer.audio.path, talkVideoPath, today, k)
      layer.talkVideo = { path: talkVideoPath }
      saveConfig(videoConfig, configPath)
    }
    const videoPath = `./out/${today}/${layout}/${videoName}.mp4`
    await genVideo(videoConfig, videoPath)
    logger.info(`[main] 视频生成成功`)

    const douyinVideo = new DouYinVideo(videoName, videoPath, ['热点', '热点新闻事件'], `./assets/thumbnail-${layout}.png`, './out/douyin_account.json')
    await douyinVideo.upload()
    logger.info(`[main] 抖音上传成功`)

    const bilibiliVideo = new BilibiliVideo(videoName, videoPath, ['热点', '资讯', '全球'], './out/bilibili_account.json')
    await bilibiliVideo.upload()
    logger.info(`[main] B站上传成功`)

    const tencentVideo = new TencentVideo(videoName, videoPath, ['热点', '资讯', '全球'], './out/tencent_account.json', '新闻资讯')
    await tencentVideo.upload()
    logger.info(`[main] 视频号上传成功`)
  }
}

const main = async () => {
  cron.schedule('0 17 * * *', async (ctx: TaskContext) => {
    console.log(`Task started at ${ctx.triggeredAt.toISOString()}`)
    console.log(`Scheduled for: ${ctx.dateLocalIso}`)
    try {
      await genNewsVideoAndUpload()
      await sendMail('🥳视频发布成功', '视频发布成功！！！🎉🎉🎉🎉🎉🎉')
    }
    catch (error) {
      let message = ''
      if (error instanceof AxiosError) {
        if (error.response) {
          message = `url: ${error.response.config.url}, code: ${error.code}, status: ${error.response.status}, data: ${error.response.data ? stringify(error.response.data) : ''}`
        }
        else {
          message = `url: ${error?.config?.url}, code: ${error.code}, cause: ${error.cause ? stringify(error.cause) : ''}`
        }
      }
      else if (error instanceof Error) {
        message = `${error.message}\n${error.stack}`
      }
      else {
        message = `${error}`
      }
      await sendMail('😢视频发布失败', `message:${message}`)
    }

    console.log(`Task status ${await ctx?.task?.getStatus()}`)
  })
}

main()
