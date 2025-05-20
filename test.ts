import 'dotenv/config'
import { TencentVideo, weixinSetup } from './src/lib/tencent'

const main = async () => {
  await weixinSetup('./out/tencent_account.json', true)
  const tencentVideo = new TencentVideo('每日全球热点新闻资讯-2025年05月20日', './out/2025-05-20/landscape/每日全球热点新闻资讯-2025年05月20日.mp4', ['热点', '资讯', '全球'], './out/tencent_account.json', '新闻资讯')
  await tencentVideo.upload()
}

main()
