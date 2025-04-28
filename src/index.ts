import fs from 'fs'
import { execa } from 'execa'

import { NewsVideoConfig } from './type.ts'
import { getTodatNews } from './utils/news.ts'
import { tts } from './utils/voice.ts'
import { genImage } from './utils/image.ts'
import { genVideo } from './utils/video.ts'

/**
 *
 * @param {string} input
 * @returns
 */
const getFFprobeWrappedExecution = async (input: string) => {
  const params = ['-v', 'error', '-show_format', '-show_streams']

  if (typeof input === 'string') {
    return await execa('ffprobe', [...params, input])
  }

  throw new Error('Given input was neither a string')
}

/**
 *
 * @param {string} input
 * @returns {number}
 */
export const getVideoDurationInSeconds = async (input: string): Promise<number> => {
  const { stdout } = await getFFprobeWrappedExecution(input)
  const matched = stdout.match(/duration="?(\d*\.\d*)"?/)
  if (matched && matched[1]) return parseFloat(matched[1])
  throw new Error('No duration found!')
}

function formatTime(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

const main = async () => {
  const today = formatTime(new Date())
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

  for (let index = 0; index < newsList.length; index++) {
    const news = newsList[index]
    videoConfig.news.push({
      title: news.title,
      content: news.content,
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
        const audioInfo = await tts(news.content, `./out/${today}/audios/${index}.mp3`)
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
      const imagePath = `./out/${today}/images/${index}.png`
      if (!fs.existsSync(imagePath)) {
        await genImage(news.title, `${videoConfig.layout.width}x${videoConfig.layout.height}`, imagePath)
      }
      videoConfig.images.push({
        path: imagePath,
        index: index,
      })
    }
    else {
      const audioInfo = await tts(news.content, `./out/${today}/audios/${index}.mp3`)
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
      const imagePath = await genImage(news.title, `${videoConfig.layout.width}x${videoConfig.layout.height}`, `./out/${today}/images/${index}.png`)
      videoConfig.images.push({
        path: imagePath,
        index: index,
      })
    }
  }

  await genVideo(videoConfig, `./out/${today}/news.mp4`)
}

main()
