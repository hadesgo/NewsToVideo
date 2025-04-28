import Editly from 'editly'
import { Subtitle } from 'tencentcloud-sdk-nodejs-tts/tencentcloud/services/tts/v20190823/tts_models.js'

interface NewsVideoConfig {
  news: { title: string, content: string, index: number }[]
  audios: { path: string, duration: number, subtitles: Subtitle[], index: number }[]
  images: { path: string, index: number }[]
  layout: {
    width: number
    height: number
    fps: number
  }
}

export const genVideo = async (config: NewsVideoConfig, outPath: string) => {
  const clips = []
  for (let index = 0; index < config.audios.length; index++) {
    const audio = config.audios[index]
    const image = config.images[index]
    const news = config.news[index]
    const clip = {
      duration: audio.duration,
      layers: [
        {
          type: 'image',
          path: image.path,
          resizeMode: 'cover',
        },
        {
          type: 'news-title',
          text: news.title,
        },
        {
          type: 'subtitle',
          text: news.content,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        {
          type: 'audio',
          path: audio.path,
        },
      ],
    }
    clips.push(clip)
  }
  await Editly({
    outPath,
    width: config.layout.width,
    height: config.layout.height,
    fps: config.layout.fps,
    keepSourceAudio: true,
    clips: clips,
  })
}
