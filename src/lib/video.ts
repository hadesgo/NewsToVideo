import Editly from 'editly'
import { NewsVideoConfig } from 'src/type.ts'
import { initTxtbox } from 'src/utils/initTxtbox.ts'

initTxtbox()

const genVideo = async (config: NewsVideoConfig, outPath: string) => {
  let width = 0
  let height = 0
  switch (config.layout) {
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
  const clips = []
  clips.push({
    duration: 5,
    layers: [
      {
        type: 'video',
        path: `./assets/Opening-${config.layout}.mp4`,
        resizeMode: 'contain',
      },
    ],
  })
  for (let index = 0; index < config.layers.length; index++) {
    const layerConfig = config.layers[index]
    const audio = layerConfig.audio
    const material = layerConfig.material
    const news = layerConfig.news
    const clip = {
      duration: layerConfig.duration,
      layers: [
        {
          type: material.type,
          path: material.path,
          resizeMode: 'contain',
          mixVolume: 0,
          cutFrom: 0,
          cutTo: layerConfig.duration,
        },
        {
          type: 'news-title',
          text: news.title,
          fontFamily: '微软雅黑',
        },
        {
          type: 'subtitle',
          text: news.content,
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

  const editlyConfig = {
    outPath,
    width: width,
    height: height,
    fps: 30,
    keepSourceAudio: true,
    clips: clips,
  }

  console.log('editlyConfig', editlyConfig)

  await Editly(editlyConfig)
}

export default genVideo
