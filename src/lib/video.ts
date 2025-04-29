import Editly from 'editly'
import { NewsVideoConfig } from 'src/type.ts'
import { initTxtbox } from 'src/utils/initTxtbox.ts'

initTxtbox()

const genVideo = async (config: NewsVideoConfig, outPath: string) => {
  const clips = []
  clips.push({
    duration: 5,
    layers: [
      {
        type: 'video',
        path: './assets/Opening.mp4',
        resizeMode: 'contain',
      },
    ],
  })
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
          text: `${news.content}\n${news.comments}\n${news.keywodrs.join(' ')}`,
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
  clips.push({
    duration: 3,
    layers: [
      {
        type: 'image',
        path: './assets/logo.png',
        resizeMode: 'contain',
      },
      {
        type: 'audio',
        path: './assets/Ending.wav',
      },
    ],
  })
  await Editly({
    outPath,
    width: config.layout.width,
    height: config.layout.height,
    fps: config.layout.fps,
    keepSourceAudio: true,
    clips: clips,
  })
}

export default genVideo
