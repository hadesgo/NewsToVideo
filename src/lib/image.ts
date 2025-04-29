import axios from 'axios'
import fs from 'fs'

const MAX_RETRY_COUNT = 3

const URL = 'https://api.siliconflow.cn/v1/images/generations'
const API_KEY = 'sk-kcqhpqquhjwesmklkvxzthvqarrliwdmlsqwqcieousxjdtp'

/**
 * sleep
 *
 * @param {number} ms 毫秒数
 * @returns {Promise<void>}
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise<void>(resolve => setTimeout(() => resolve(), ms))
}

const genImage = async (text: string, imageSize: string, imagePath: string) => {
  let retryCount = 0
  let networkError = null
  while (retryCount < MAX_RETRY_COUNT) {
    try {
      const postBody = {
        model: 'Kwai-Kolors/Kolors',
        prompt: text.replaceAll('中央政治局', ''),
        image_size: imageSize,
      }
      const res = await axios.post(URL, postBody, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      })
      const imageUrl = res.data.images[0].url
      const imageRes = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      })
      fs.writeFileSync(imagePath, imageRes.data)
      return imagePath
    }
    catch (error) {
      networkError = error
      retryCount += 1
      await sleep(1000 * 60)
    }
    throw networkError
  }
}

export default genImage
