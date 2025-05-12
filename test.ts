import { addSilence } from './src/utils/ffmpeg.ts'
import news from './src/lib/news.ts'
import tts from './src/lib/tts.ts'
import Editly from 'editly'
import path from 'path'
import { createClient, Videos, ErrorResponse } from 'pexels'

const main = async () => {
  const newList = await news()
  console.log(newList)
  // const API_KEY = 'flKAf6wzHqQllPQGbRpWpPOdOyLWkM3zA8z2phmApDNcuMNKeRtM3BMV'
  // const Client = createClient(API_KEY)
  // const res = await Client.videos.search({ query: '俄乌冲突', orientation: 'landscape', locale: 'zh-CN' })
  // console.log(res)
}

main()
