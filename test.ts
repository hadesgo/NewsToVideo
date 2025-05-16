import 'dotenv/config'
import { sendMail } from './src/lib/email.ts'

const main = async () => {
  await sendMail('任务成功', '1234')
}

main()
