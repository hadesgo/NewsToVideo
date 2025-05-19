import 'dotenv/config'
import { sendMail } from './src/lib/email.ts'
import news from './src/lib/news.ts'

const main = async () => {
  console.log(await news())
}

main()
