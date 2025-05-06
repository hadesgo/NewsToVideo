import { Subtitle } from 'tencentcloud-sdk-nodejs-tts/tencentcloud/services/tts/v20190823/tts_models.js'

export type LayoutType = 'landscape' | 'portrait'

export interface NewsVideoConfig {
  layers: {
    news: { title: string, content: string, keywodrs: string[] }
    audio: { path: string, subtitles: Subtitle[] | undefined }
    material: { path: string, type: 'image' | 'video' }
    duration: number
  }[]
  layout: LayoutType
}
