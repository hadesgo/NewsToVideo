import type { CustomFabricFunctionArgs, CustomFabricFunctionCallbacks, VideoPostProcessingFunctionArgs } from 'editly'
import Editly from 'editly'

import { NewsVideoConfig } from 'src/type.ts'

export const isUrl = (path: string) => /^https?:\/\//.test(path)

function textBoxfunc({ width, height, fabric, params }: CustomFabricFunctionArgs): CustomFabricFunctionCallbacks {
  return {
    async onRender(progress, canvas) {
      canvas.backgroundColor = 'hsl(33, 100%, 50%)'

      const backgroundParallelogram = new fabric.Polygon([{ x: 40, y: 0 }, { x: 1540, y: 0 }, { x: 1500, y: 210 }, { x: 0, y: 210 }], {
        fill: 'white',
      })
      backgroundParallelogram.left = (width - backgroundParallelogram.width) / 2
      backgroundParallelogram.top = height - backgroundParallelogram.height - 80
      canvas.add(backgroundParallelogram)

      const bottomParallelogram = new fabric.Polygon([{ x: 20, y: 0 }, { x: 570, y: 0 }, { x: 550, y: 50 }, { x: 0, y: 50 }], {
        fill: '#5B5C82',
      })
      bottomParallelogram.left = width - bottomParallelogram.width - 260
      bottomParallelogram.top = height - bottomParallelogram.height - 60
      canvas.add(bottomParallelogram)

      const topLeftParallelogram = new fabric.Polygon([{ x: 15, y: 0 }, { x: 295, y: 0 }, { x: 280, y: 45 }, { x: 0, y: 45 }], {
        fill: '#FD3A49',
      })

      topLeftParallelogram.left = width - topLeftParallelogram.width - 1240
      topLeftParallelogram.top = height - topLeftParallelogram.height - 270
      canvas.add(topLeftParallelogram)

      const topLeftSmallParallelogram = new fabric.Polygon([{ x: 15, y: 0 }, { x: 23, y: 0 }, { x: 8, y: 45 }, { x: 0, y: 45 }], {
        fill: '#5B5B78',
      })

      topLeftSmallParallelogram.left = topLeftParallelogram.left + topLeftParallelogram.width - 12
      topLeftSmallParallelogram.top = topLeftParallelogram.top
      canvas.add(topLeftSmallParallelogram)

      const cloneItem = await topLeftSmallParallelogram.clone()
      cloneItem.left = topLeftSmallParallelogram.left + 11
      canvas.add(cloneItem)

      const topRightParallelogram = new fabric.Polygon([{ x: 15, y: 0 }, { x: 295, y: 0 }, { x: 280, y: 75 }, { x: 0, y: 75 }], {
        fill: '#5C5C85',
      })
      topRightParallelogram.left = width - topRightParallelogram.width - 105
      topRightParallelogram.top = height - topRightParallelogram.height - 320
      canvas.add(topRightParallelogram)

      const RedTopRightParallelogram = new fabric.Polygon([{ x: 15, y: 0 }, { x: 245, y: 0 }, { x: 230, y: 75 }, { x: 0, y: 75 }], {
        fill: '#E73848',
      })
      RedTopRightParallelogram.left = width - RedTopRightParallelogram.width - 150
      RedTopRightParallelogram.top = height - RedTopRightParallelogram.height - 255
      canvas.add(RedTopRightParallelogram)

      const RedTopRightTriangle = new fabric.Polygon([{ x: 5, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }], {
        fill: '#FC3A46',
      })
      RedTopRightTriangle.left = width - RedTopRightTriangle.width - 165
      RedTopRightTriangle.top = RedTopRightParallelogram.top + RedTopRightParallelogram.height
      canvas.add(RedTopRightTriangle)

      const latestTextBox = new fabric.Textbox('每日全球', { fill: 'white', fontWeight: 'bold', fontSize: 55, fontFamily: '微软雅黑' })
      latestTextBox.left = topRightParallelogram.left + (latestTextBox.width / 6)
      latestTextBox.top = topRightParallelogram.top + (latestTextBox.height / 7)
      canvas.add(latestTextBox)

      const newsTextBox = new fabric.Textbox('热点新闻', { fill: 'white', fontWeight: 'bold', fontSize: 45, fontFamily: '微软雅黑' })
      newsTextBox.left = RedTopRightParallelogram.left + (newsTextBox.width / 5)
      newsTextBox.top = RedTopRightParallelogram.top + (newsTextBox.height / 5)
      canvas.add(newsTextBox)

      const newsTitle = new fabric.Textbox(params.title, { fill: '#41318E', fontWeight: 'bold', fontSize: 35, fontFamily: '微软雅黑', width: 1000 })
      newsTitle.left = 485
      newsTitle.top = 825
      canvas.add(newsTitle)

      const contentTitle = new fabric.Textbox(params.content, { fill: '#41318E', fontSize: 30, fontFamily: '微软雅黑', width: 1160, splitByGrapheme: true })
      contentTitle.left = 485
      contentTitle.top = 875
      canvas.add(contentTitle)
    },

    onClose() {
      // Cleanup if you initialized anything
    },
  }
}

async function avatarfunc({ image, fabric }: VideoPostProcessingFunctionArgs): Promise<void> {
  const config = {
    height: 854,
    width: 854,
    x: 118,
    y: -41,
  }
  const radius = Math.min(config.width, config.height) / 2
  const circle = new fabric.Circle({
    radius,
    left: -radius,
    top: -radius,
    objectCaching: false,
  })
  image.set({
    cropX: config.x,
    cropY: config.y,
    width: config.width,
    height: config.height,
    left: -config.width / 2,
    top: -config.height / 2,
    clipPath: circle,
  })
  image.left = 105
  image.top = 680
  image.scaleToWidth(336)
}

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
    duration: 3,
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
    const talkVideo = layerConfig.talkVideo
    const material = layerConfig.material
    const news = layerConfig.news
    const clip = {
      duration: layerConfig.duration,
      layers: [
        {
          type: 'video',
          cutFrom: 0,
          cutTo: layerConfig.duration,
          path: './assets/backgroud_video.mp4',
          resizeMode: 'cover',
        },
        {
          type: material.type,
          path: material.path,
          resizeMode: 'contain',
          mixVolume: 0,
          cutFrom: 0,
          cutTo: layerConfig.duration,
          width: 0.67,
          height: 0.67,
          originX: 'center',
          originY: 'bottom',
          left: 0.5,
          top: 0.735,
        },
        {
          type: 'fabric',
          func: textBoxfunc,
          title: news.title,
          content: news.content,
        },
        {
          type: 'video',
          cutFrom: 0,
          cutTo: layerConfig.duration,
          resizeMode: 'contain',
          path: talkVideo.path,
          fabricImagePostProcessing: avatarfunc,
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
