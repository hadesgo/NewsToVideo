import { addSilence } from './src/utils/ffmpeg.ts'
import getTodatNews from './src/lib/news.ts'
import tts from './src/lib/voice.ts'
import Editly from 'editly'
import path from 'path'

const main = async () => {
  const news = await getTodatNews()
  console.log(news)
}

main()
