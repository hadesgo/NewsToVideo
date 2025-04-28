import axios from 'axios'
import fs from 'fs'

const URL = 'https://api.siliconflow.cn/v1/images/generations'
const API_KEY = 'sk-kcqhpqquhjwesmklkvxzthvqarrliwdmlsqwqcieousxjdtp'

export const genImage = async (text: string, imageSize: string, imagePath: string) => {
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
