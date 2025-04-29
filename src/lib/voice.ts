import * as tencentcloud from 'tencentcloud-sdk-nodejs-tts'
import crypto from 'crypto'
import fs from 'fs'

import { addSilence } from 'src/utils/ffmpeg.ts'

// 导入对应产品模块的client models。
const TtsClient = tencentcloud.tts.v20190823.Client

const clientConfig = {
  // 腾讯云认证信息
  credential: {
    secretId: 'AKIDKbmgT3PcdGi1FI8kBRVM2ZtzrX0KUTFr',
    secretKey: 'UkpgOvGPL3by87sQnxtb9Ve0GJD6Xlpj',
  },
  profile: {
    httpProfile: {
      endpoint: 'tts.tencentcloudapi.com',
    },
  },
}

// 实例化要请求产品(以tts为例)的client对象
const client = new TtsClient(clientConfig)

const tts = async (text: string, outputPath: string) => {
  const params = {
    Text: text,
    SessionId: crypto.randomUUID(),
    VoiceType: 101022,
    EnableSubtitle: true,
    Codec: 'mp3',
  }
  const res = await client.TextToVoice(params)
  if (res.Audio) {
    const audioBuffer = Buffer.from(res.Audio, 'base64')
    fs.writeFileSync(outputPath, audioBuffer)
    await addSilence(outputPath, 0.3)
  }
  return {
    audio: outputPath,
    subtitles: res.Subtitles,
  }
}

export default tts
