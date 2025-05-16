import Editly from 'editly'
import path from 'path'
import { createClient, Videos, ErrorResponse } from 'pexels'

import { addSilence } from './src/utils/ffmpeg.ts'
import news from './src/lib/news.ts'
import tts from './src/lib/tts.ts'

import { douyinSetup, DouYinVideo } from './src/lib/douyin.ts'

const main = async () => {
  const douyinVideo = new DouYinVideo('test', './out/2025-05-15/landscape/每日全球热点新闻资讯-2025年05月15日.mp4', ['热点', '热点新闻事件'], './out/douyin_account.json')
  await douyinVideo.upload()
  // const API_KEY = 'flKAf6wzHqQllPQGbRpWpPOdOyLWkM3zA8z2phmApDNcuMNKeRtM3BMV'
  // const Client = createClient(API_KEY)
  // const res = await Client.videos.search({ query: '俄乌冲突', orientation: 'landscape', locale: 'zh-CN' })
  // console.log(res)
}

main()
