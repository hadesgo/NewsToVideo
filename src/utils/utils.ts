import fs from 'fs'
import axios from 'axios'

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
