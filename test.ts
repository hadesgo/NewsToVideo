import Editly from 'editly'
import path from 'path'
import { createClient, Videos, ErrorResponse } from 'pexels'

import { addSilence } from './src/utils/ffmpeg.ts'
import news from './src/lib/news.ts'
import tts from './src/lib/tts.ts'

import { douyinSetup, DouYinVideo } from './src/lib/douyin.ts'
import { BilibiliVideo } from './src/lib/bilibili.ts'
import cron, { TaskContext } from 'node-cron'

const main = async () => {
  cron.schedule('15 14 * * *', async (ctx: TaskContext) => {
    console.log(`Task started at ${ctx.triggeredAt.toISOString()}`)
    console.log(`Scheduled for: ${ctx.dateLocalIso}`)
    console.log(`Task status ${await ctx?.task?.getStatus()}`)
  })
}

main()
