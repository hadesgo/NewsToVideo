import { execa } from 'execa'
import path from 'path'
import fs from 'fs'

/**
 *
 * @param {string} input
 * @returns
 */
const getFFprobeWrappedExecution = async (input: string) => {
  const params = ['-v', 'error', '-show_format', '-show_streams']

  if (typeof input === 'string') {
    return await execa('ffprobe', [...params, input])
  }

  throw new Error('Given input was neither a string')
}

/**
 *
 * @param {string} input
 * @returns {number}
 */
export const getVideoDurationInSeconds = async (input: string): Promise<number> => {
  const { stdout } = await getFFprobeWrappedExecution(input)
  const matched = stdout.match(/duration="?(\d*\.\d*)"?/)
  if (matched && matched[1]) return parseFloat(matched[1])
  throw new Error('No duration found!')
}

export const addSilence = async (input: string, silenceDuration: number) => {
  const pathObj = path.parse(input)
  pathObj.name += '-silence'
  pathObj.base = pathObj.name + pathObj.ext
  const outPath = path.format(pathObj)
  const args = [
    '-f', 'lavfi',
    '-t', `${silenceDuration}`,
    '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
    '-i', input,
    '-filter_complex', '[0:a][1:a][0:a]concat=n=3:v=0:a=1[outa]',
    '-map', '[outa]',
    outPath,
  ]
  await execa('ffmpeg', args)
  fs.unlinkSync(input)
  fs.renameSync(outPath, input)
  return input
}
