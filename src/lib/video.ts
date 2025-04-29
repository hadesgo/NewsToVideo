import Editly from 'editly'
import { NewsVideoConfig } from 'src/type.ts'
import { initTxtbox } from 'src/utils/initTxtbox.ts'

initTxtbox()

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
          fontFamily: '微软雅黑',
        },
        {
          type: 'subtitle',
          text: `{news.content}\n${news.comments}`,
          backgroundColor: 'rgba(0,0,0,0.5)',
          fontFamily: '微软雅黑',
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
