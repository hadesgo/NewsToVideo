import nodemailer from 'nodemailer'
import logger from './logger.ts'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'lys219911@gmail.com',
    pass: process.env.GOOGLE_APP_PASSWORD,
  },
})

const mailOptions = {
  from: 'lys219911@gmail.com',
  to: 'hadesgo@qq.com',
  subject: '任务完成通知',
  html: '<p>您的任务已完成！</p>',
}

export const sendMail = async (subject: string, content: string) => {
  // 发送邮件
  try {
    mailOptions.subject = subject
    mailOptions.html = content
    const info = await transporter.sendMail(mailOptions)
    logger.info('[EMAIL] 邮件发送成功:', info.messageId)
    return info
  }
  catch (error) {
    logger.error('[EMAIL] 邮件发送失败:', error)
    throw error
  }
}
