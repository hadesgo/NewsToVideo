import 'dotenv/config'
import { TencentVideo } from './src/lib/tencent.ts'

const main = async () => {
  const tencentVideo = new TencentVideo('每日全球热点新闻资讯-2025年05月19日', './out/2025-05-19/landscape/每日全球热点新闻资讯-2025年05月19日.mp4', ['热点', '资讯', '全球'], './out/tencent_account.json', '新闻资讯')
  await tencentVideo.upload()
}

main()
