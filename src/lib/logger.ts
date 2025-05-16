import { createLogger, format, transports } from 'winston'
import 'winston-daily-rotate-file'

const dayTransport = new transports.DailyRotateFile({
  dirname: './logs',
  filename: '%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: '100m',
  maxFiles: '15d',
})

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.splat(), // util.format supported
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.printf(info => `[${info.timestamp}] [${info.level.toUpperCase()}] - ${info.message}`),
  ),
  transports: [dayTransport],
})

export default logger
