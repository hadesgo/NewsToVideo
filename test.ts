import { addSilence } from './src/utils/ffmpeg.ts'
import getTodatNews from './src/lib/news.ts'
import Editly from 'editly'
import path from 'path'

const main = async () => {
  const clips = []
  clips.push({
    duration: 5,
    layers: [
      {
        type: 'video',
        path: './assets/Opening.mp4',
      },
    ],
  })
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
    outPath: './test.mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    keepSourceAudio: true,
    clips: clips,
  })
}

main()
