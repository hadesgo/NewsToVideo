import { addSilence } from './src/utils/ffmpeg.ts'
import getTodatNews from './src/lib/news.ts'
import tts from './src/lib/tts.ts'
import Editly from 'editly'
import path from 'path'

const main = async () => {
  tts('特朗普宣布拟对海外制作电影征收100%关税，可能冲击好莱坞海外市场，并激化美国内部矛盾。加州已就此起诉联邦政府。', './test.mp3')
}

main()
