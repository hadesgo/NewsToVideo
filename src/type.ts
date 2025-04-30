import { Subtitle } from 'tencentcloud-sdk-nodejs-tts/tencentcloud/services/tts/v20190823/tts_models.js'

export type LayoutType = 'landscape' | 'portrait'

export interface NewsVideoConfig {
  news: { title: string, content: string, comments: string, keywodrs: string[], index: number }[]
  audios: { path: string, duration: number, subtitles: Subtitle[] | undefined, index: number }[]
  images: { path: string, index: number }[]
  layout: LayoutType
}
