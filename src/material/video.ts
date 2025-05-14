import { createClient, Videos, ErrorResponse } from 'pexels'
import mime from 'mime'
import path from 'path'

import { downloadFile } from 'src/utils/utils.ts'

const API_KEY = 'flKAf6wzHqQllPQGbRpWpPOdOyLWkM3zA8z2phmApDNcuMNKeRtM3BMV'
const Client = createClient(API_KEY)

const getVideo = async (query: string, orientation: string, duration: number, videoDir: string, index: number) => {
  let baseWidth = 0
  let baseHeight = 0
  switch (orientation) {
    case 'landscape':
      baseWidth = 1920
      baseHeight = 1080
      break
    case 'portrait':
      baseWidth = 1080
      baseHeight = 1920
      break
    default:
      break
  }
  const res = await Client.videos.search({ query, orientation: orientation, per_page: 80 })
  if ((res as ErrorResponse).error) {
    throw new Error((res as ErrorResponse).error)
  }
  else {
    const durationVideos = []
    const videos = (res as Videos).videos
    for (const video of videos) {
      if (video.duration >= duration) {
        durationVideos.push(video)
      }
    }
    if (durationVideos.length < 1) {
      return ''
    }
    const video = durationVideos[Math.floor(Math.random() * durationVideos.length)]
    const resourceList = video.video_files.sort((a, b) => (a.width == null ? 0 : a.width) - (b.width == null ? 0 : b.width))
    for (let i = 0; i < resourceList.length; i++) {
      const element = resourceList[i]
      if (element.width !== null && element.height !== null) {
        if (element.width >= baseWidth && element.height >= baseHeight) {
          const extension = mime.getExtension(element.file_type)
          const fileName = `${index}.${extension}`
          const filePath = path.join(videoDir, fileName)
          await downloadFile(element.link, filePath)
          return filePath
        }
      }
    }
  }
  return ''
}

export default getVideo
