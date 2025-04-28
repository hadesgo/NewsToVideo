import * as tencentcloud from 'tencentcloud-sdk-nodejs-tts'
import crypto from 'crypto'
import fs from 'fs'

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

export const tts = async (text: string, outputPath: string) => {
  const params = {
    Text: text,
    SessionId: crypto.randomUUID(),
    VoiceType: 101012,
    EnableSubtitle: true,
    Codec: 'mp3',
  }
  const res = await client.TextToVoice(params)
  if (res.Audio) {
    const binaryData = Buffer.from(res.Audio, 'base64')
    fs.writeFileSync(outputPath, binaryData)
  }
  return {
    audio: outputPath,
    subtitles: res.Subtitles,
  }
}
