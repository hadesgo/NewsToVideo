import { execa } from 'execa'

export class BilibiliVideo {
  #title: string
  #tags: string[]
  #filePath: string
  #accountFile: string

  constructor(title: string, filePath: string, tags: string[], accountFile: string) {
    this.#title = title
    this.#filePath = filePath
    this.#tags = tags
    this.#accountFile = accountFile
  }

  async upload() {
    const args = [
      '--user-cookie', this.#accountFile,
      'upload',
      '--line', 'bda2',
      '--tid', '202',
      '--title', this.#title,
      '--tag', this.#tags.join(','),
      this.#filePath,
    ]
    await execa('./assets/biliup.exe', args)
  }
}
