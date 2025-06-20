import fs from 'fs'
import axios from 'axios'
import { BrowserContext } from 'playwright'
import FormData from 'form-data'

import { NewsVideoConfig } from 'src/type.ts'

/**
 * sleep
 *
 * @param {number} ms 毫秒数
 * @returns {Promise<void>}
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise<void>(resolve => setTimeout(() => resolve(), ms))
}

/**
 * 下载文件
 *
 * @param {string} url 下载地址
 * @param {string} filePath 文件路径
 * @returns {Promise<void>} 文件路径
 */
export const downloadFile = async (url: string, filePath: string = ''): Promise<void> => {
  const imageRes = await axios.get(url, {
    responseType: 'arraybuffer',
  })
  fs.writeFileSync(filePath, imageRes.data)
}

export const saveConfig = (config: NewsVideoConfig, filePath: string): void => {
  fs.writeFileSync(filePath, JSON.stringify(config), 'utf-8')
}

export const setInitScript = async (context: BrowserContext) => {
  const stealthJsPath = './assets/stealth.min.js'
  await context.addInitScript({ path: stealthJsPath })
  return context
}

export async function genTalkVideo(audioPath: string, videoPath: string, today: string, index: number) {
  const form = new FormData()
  form.append('file', fs.createReadStream(audioPath), { filename: `${today}-${index}.mp3`, contentType: 'audio/mp3' }) // 替换为你的音频路径
  const response = await axios.post('http://192.168.7.240:3000/generate_video', form, {
    headers: form.getHeaders(),
    responseType: 'stream',
  })
  // 保存返回的视频
  const writer = fs.createWriteStream(videoPath)
  response.data.pipe(writer)
  await new Promise((resolve, reject) => {
    writer.once('error', (err) => {
      reject(err)
    })
    writer.once('close', () => {
      resolve(true)
    })
  })
}
