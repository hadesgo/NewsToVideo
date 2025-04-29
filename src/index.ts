import fs from 'fs'

import { NewsVideoConfig } from './type.ts'
import getTodatNews from './lib/news.ts'
import tts from './lib/voice.ts'
import genImage from './lib/image.ts'
import genVideo from './lib/video.ts'
import { getVideoDurationInSeconds } from './utils/ffmpeg.ts'

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
  fs.mkdirSync(`./out/${today}`, { recursive: true })
  fs.mkdirSync(`./out/${today}/audios`, { recursive: true })
  fs.mkdirSync(`./out/${today}/images`, { recursive: true })

  const videoConfig: NewsVideoConfig = { news: [], audios: [], images: [], layout: { width: 1920, height: 1080, fps: 30 } }
  const newsJsonFilePath = `./out/${today}/news.json`
  let isCache = false
  let newsList = []
  if (fs.existsSync(newsJsonFilePath)) {
    newsList = JSON.parse(fs.readFileSync(newsJsonFilePath, 'utf-8'))
    isCache = true
  }
  else {
    newsList = await getTodatNews()
    fs.writeFileSync(newsJsonFilePath, JSON.stringify(newsList))
  }
  console.log(`获取到 ${newsList.length} 条新闻`)
  for (let index = 0; index < newsList.length; index++) {
    const news = newsList[index]
    videoConfig.news.push({
      title: news.title,
      content: news.content,
      comments: news.comments,
      keywodrs: news.keywords,
      index: index,
    })
    if (isCache) {
      const audioPath = `./out/${today}/audios/${index}.mp3`
      const subtitleFilePath = `./out/${today}/audios/${index}.json`
      if (fs.existsSync(audioPath)) {
        videoConfig.audios.push({
          path: `./out/${today}/audios/${index}.mp3`,
          subtitles: fs.existsSync(subtitleFilePath) ? JSON.parse(fs.readFileSync(subtitleFilePath, 'utf-8')) : undefined,
          index: index,
          duration: await getVideoDurationInSeconds(`./out/${today}/audios/${index}.mp3`),
        })
      }
      else {
        const audioInfo = await tts(`${news.content}\n${news.comments}`, `./out/${today}/audios/${index}.mp3`)
        const subtitleFilePath = `./out/${today}/audios/${index}.json`
        if (audioInfo.subtitles) {
          fs.writeFileSync(subtitleFilePath, JSON.stringify(audioInfo.subtitles))
        }
        videoConfig.audios.push({
          path: audioInfo.audio,
          subtitles: audioInfo.subtitles,
          index: index,
          duration: await getVideoDurationInSeconds(audioInfo.audio),
        })
      }
      console.log(`音频 ${index} 生成完成, 进度: ${index + 1}/${newsList.length}`)
      const imagePath = `./out/${today}/images/${index}.png`
      if (!fs.existsSync(imagePath)) {
        await genImage(news.keywords[0], `${videoConfig.layout.width}x${videoConfig.layout.height}`, imagePath)
      }
      videoConfig.images.push({
        path: imagePath,
        index: index,
      })
      console.log(`图片 ${index} 生成完成, 进度: ${index + 1}/${newsList.length}`)
    }
    else {
      const audioInfo = await tts(`${news.content}\n${news.comments}`, `./out/${today}/audios/${index}.mp3`)
      const subtitleFilePath = `./out/${today}/audios/${index}.json`
      if (audioInfo.subtitles) {
        fs.writeFileSync(subtitleFilePath, JSON.stringify(audioInfo.subtitles))
      }
      videoConfig.audios.push({
        path: audioInfo.audio,
        subtitles: audioInfo.subtitles,
        index: index,
        duration: await getVideoDurationInSeconds(audioInfo.audio),
      })
      console.log(`音频 ${index} 生成完成, 进度: ${index + 1}/${newsList.length}`)
      const imagePath = await genImage(news.keywords[0], `${videoConfig.layout.width}x${videoConfig.layout.height}`, `./out/${today}/images/${index}.png`)
      videoConfig.images.push({
        path: imagePath || '',
        index: index,
      })
      console.log(`图片 ${index} 生成完成, 进度: ${index + 1}/${newsList.length}`)
    }
  }

  await genVideo(videoConfig, `./out/${today}/${videoName}.mp4`)
}

main()
