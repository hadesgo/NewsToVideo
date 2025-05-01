import { addSilence } from './src/utils/ffmpeg.ts'
import getTodatNews from './src/lib/news.ts'
import tts from './src/lib/voice.ts'
import Editly from 'editly'
import path from 'path'

const main = async () => {
  const editlyConfig = {
    outPath: 'test.mp4',
    width: 960,
    height: 720,
    fps: 25,
    keepSourceAudio: true,
    clips: [
      {
        duration: 5,
        layers: [
          {
            type: 'video',
            path: `./assets/Opening-landscape.mp4`,
            resizeMode: 'contain',
          },
        ],
      },
      {
        duration: 2,
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
      },
    ],
  }
  await Editly(editlyConfig)
}

main()
