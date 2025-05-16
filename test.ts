import Editly from 'editly'
import path from 'path'
import { createClient, Videos, ErrorResponse } from 'pexels'

import { addSilence } from './src/utils/ffmpeg.ts'
import news from './src/lib/news.ts'
import tts from './src/lib/tts.ts'

import { douyinSetup, DouYinVideo } from './src/lib/douyin.ts'
import { BilibiliVideo } from './src/lib/bilibili.ts'

const main = async () => {
  const bilibiliVideo = new BilibiliVideo('test', './out/2025-05-15/landscape/每日全球热点新闻资讯-2025年05月15日.mp4', ['热点', '资讯', '全球'], './out/bilibili_account.json')
  await bilibiliVideo.upload()
}

main()
