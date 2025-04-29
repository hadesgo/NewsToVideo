import { execa } from 'execa'

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
