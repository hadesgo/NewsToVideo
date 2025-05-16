import Editly from 'editly'
import path from 'path'
import { createClient, Videos, ErrorResponse } from 'pexels'

import { addSilence } from './src/utils/ffmpeg.ts'
import news from './src/lib/news.ts'
import tts from './src/lib/tts.ts'

import { douyinSetup, DouYinVideo } from './src/lib/douyin.ts'
import { BilibiliVideo } from './src/lib/bilibili.ts'
import cron from 'node-cron'

const main = async () => {
  cron.schedule('1 * * * * *', () => {
    console.log('每天凌晨 3 点执行的定时任务')
  })
}

main()
