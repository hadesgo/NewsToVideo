import { addSilence } from './src/utils/ffmpeg.ts'
import getTodatNews from './src/lib/news.ts'
import tts from './src/lib/tts.ts'
import Editly from 'editly'
import path from 'path'

const main = async () => {
  // console.log(await getTodatNews())
  const API_KEY = 'flKAf6wzHqQllPQGbRpWpPOdOyLWkM3zA8z2phmApDNcuMNKeRtM3BMV'
  const client = createClient(API_KEY)
  const query = 'StockMarket'
  const videoList = await client.videos.search({ query, orientation: 'landscape' })
  console.log(videoList)
}

main()
