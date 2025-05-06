import fs from 'fs'
import path from 'path'

import { NewsVideoConfig, LayoutType } from './type.ts'
import news from './lib/news.ts'
import tts from './lib/tts.ts'
import genImage from './material/image.ts'
import genVideo from './lib/video.ts'
import { getVideoDurationInSeconds } from './utils/ffmpeg.ts'

const videoLayouts = ['landscape', 'portrait']

function formatTime(date: Date): string[] {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return [`${year}-${month}-${day}`, `${year}年${month}月${day}日`]
}

const main = async () => {
  const formatTodays = formatTime(new Date())
  const today = formatTodays[0]
  const videoName = `每日全球热点新闻资讯-${formatTodays[1]}`

  const todayDir = `./out/${today}`
  fs.mkdirSync(todayDir, { recursive: true })

  const aduioDir = `./out/${today}/audios`
  fs.mkdirSync(aduioDir, { recursive: true })

  const newsJsonFilePath = `./out/${today}/news.json`
  let newsList = []
  if (fs.existsSync(newsJsonFilePath)) {
    newsList = JSON.parse(fs.readFileSync(newsJsonFilePath, 'utf-8'))
  }
  else {
    newsList = await news()
    fs.writeFileSync(newsJsonFilePath, JSON.stringify(newsList))
  }
  console.log(`获取到 ${newsList.length} 条新闻`)

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
    const videoConfig: NewsVideoConfig = { news: [], audios: [], images: [], videos: [], layout: layout as LayoutType }

    const imageDir = `./out/${today}/${layout}/images`
    fs.mkdirSync(imageDir, { recursive: true })
    const videoDir = `./out/${today}/${layout}/videos`
    fs.mkdirSync(videoDir, { recursive: true })

    for (let j = 0; j < newsList.length; j++) {
      // 生成视频配置
      const news = newsList[j]
      videoConfig.news.push({
        title: news.title,
        content: news.content,
        keywodrs: news.keywords,
        index: j,
      })
      // 生成音频
      const audioPath = path.join(aduioDir, `${j}.mp3`)
      const subtitleFilePath = path.join(aduioDir, `${j}.json`)
      if (fs.existsSync(audioPath)) {
        videoConfig.audios.push({
          path: audioPath,
          subtitles: fs.existsSync(subtitleFilePath) ? JSON.parse(fs.readFileSync(subtitleFilePath, 'utf-8')) : undefined,
          index: j,
          duration: await getVideoDurationInSeconds(audioPath),
        })
      }
      else {
        const audioInfo = await tts(`${news.content}\n${news.comments}`, audioPath)
        if (audioInfo.subtitles) {
          fs.writeFileSync(subtitleFilePath, JSON.stringify(audioInfo.subtitles))
        }
        videoConfig.audios.push({
          path: audioInfo.audio,
          subtitles: audioInfo.subtitles,
          index: j,
          duration: await getVideoDurationInSeconds(audioInfo.audio),
        })
      }
      console.log(`音频 ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
      // 生成图片
      const imagePath = path.join(imageDir, `${j}.png`)
      if (!fs.existsSync(imagePath)) {
        await genImage(news.keywords.join(','), `${width}x${height}`, imagePath)
      }
      videoConfig.images.push({
        path: imagePath,
        index: j,
      })
      console.log(`图片 ${j} 生成完成, 进度: ${j + 1}/${newsList.length}`)
    }
    await genVideo(videoConfig, `./out/${today}/${layout}/${videoName}.mp4`)
  }
}

main()
