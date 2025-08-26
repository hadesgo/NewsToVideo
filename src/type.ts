
export type LayoutType = 'landscape' | 'portrait'

export interface NewsVideoConfig {
  layers: {
    news: { title: string, content: string, keywodrs: string[] }
    audio: { path: string }
    talkVideo: { path: string }
    material: { path: string, type: 'image' | 'video' }
    duration: number
  }[]
  layout: LayoutType
}
