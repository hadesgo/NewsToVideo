import { chromium, Page } from 'playwright'
import fs from 'node:fs'

import { sleep, setInitScript } from 'src/utils/utils.ts'
import logger from './logger.ts'

const cookieAuth = async (accountFile: string) => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: accountFile })
  const page = await context.newPage()
  await page.goto('https://creator.douyin.com/creator-micro/content/upload')
  try {
    await page.waitForURL('https://creator.douyin.com/creator-micro/content/upload', { timeout: 5000 })
  }
  catch {
    console.log('[抖音] [+] 等待5秒 cookie 失效')
    await context.close()
    await browser.close()
    return false
  }

  // 2024.06.17 抖音创作者中心改版
  if (await page.getByText('手机号登录').count() || await page.getByText('扫码登录').count()) {
    console.log('[抖音] [+] 等待5秒 cookie 失效')
    return false
  }
  else {
    console.log('[抖音] [+] cookie 有效')
    return true
  }
}

export const douyinSetup = async (accountFile: string, handle = false) => {
  if (!fs.existsSync(accountFile) || !await cookieAuth(accountFile)) {
    if (!handle) {
      return false
    }
    logger.info('[抖音] [+] cookie文件不存在或已失效，即将自动打开浏览器，请扫码登录，登陆后会自动生成cookie文件')
    await douyinCookieGen(accountFile)
  }
  return true
}

const douyinCookieGen = async (accountFile: string) => {
  const options = {
    headless: false,
  }
  // Make sure to run headed.
  const browser = await chromium.launch(options)
  // Setup context however you like.
  let context = await browser.newContext()
  context = await setInitScript(context)
  // Pause the page, and start recording manually.
  const page = await context.newPage()
  await page.goto('https://creator.douyin.com/')
  await page.pause()
  // 点击调试器的继续，保存cookie
  await context.storageState({ path: accountFile })
}

export class DouYinVideo {
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

  async handelUploadError(page: Page) {
    logger.info('[抖音] 视频出错了，重新上传中')
    await page.locator('div.progress-div [class^="upload-btn-input"]').setInputFiles(this.#filePath)
  }

  async upload() {
    // 使用 Chromium 浏览器启动一个浏览器实例
    const browser = await chromium.launch({ headless: true })
    // 创建一个浏览器上下文，使用指定的 cookie 文件
    let context = await browser.newContext({ storageState: this.#accountFile })
    context = await setInitScript(context)

    // 创建一个新的页面
    const page = await context.newPage()
    // 访问指定的 URL
    await page.goto('https://creator.douyin.com/creator-micro/content/upload')
    logger.info(`[抖音] [+]正在上传-------${this.#title}.mp4`)
    // 等待页面跳转到指定的 URL，没进入，则自动等待到超时
    logger.info('[抖音] [-] 正在打开主页...')
    await page.waitForURL('https://creator.douyin.com/creator-micro/content/upload')
    // 点击 "上传视频" 按钮
    await page.locator('div[class^=\'container\'] input').setInputFiles(this.#filePath)

    // 等待页面跳转到指定的 URL 2025.01.08修改在原有基础上兼容两种页面
    while (true) {
      try {
        // 尝试等待第一个 URL
        await page.waitForURL('https://creator.douyin.com/creator-micro/content/publish?enter_from=publish_page', { timeout: 3000 })
        logger.info('[抖音] [+] 成功进入version_1发布页面!')
        break // 成功进入页面后跳出循环
      }
      catch {
        try {
          // 如果第一个 URL 超时，再尝试等待第二个 URL
          await page.waitForURL('https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page', { timeout: 3000 })
          logger.info('[抖音] [+] 成功进入version_2发布页面!')
          break // 成功进入页面后跳出循环
        }
        catch {
          logger.error('[抖音] [-] 超时未进入视频发布页面，重新尝试...')
          console.log('[抖音] [-] 超时未进入视频发布页面，重新尝试...')
          await sleep(500) // 等待 0.5 秒后重新尝试
        }
      }
    }
    // 填充标题和话题
    // 检查是否存在包含输入框的元素
    // 这里为了避免页面变化，故使用相对位置定位：作品标题父级右侧第一个元素的input子元素
    await sleep(1000)
    logger.info('[抖音] [-] 正在填充标题和话题...')
    let titleContainer = page.getByText('作品标题').locator('..').locator('xpath=following-sibling::div[1]').locator('input')
    if (await titleContainer.count()) {
      await titleContainer.fill(this.#title)
    }
    else {
      titleContainer = page.locator('.notranslate')
      await titleContainer.click()
      await page.keyboard.press('Backspace')
      await page.keyboard.press('Control+KeyA')
      await page.keyboard.press('Delete')
      await page.keyboard.type(this.#title)
      await page.keyboard.press('Enter')
    }
    const cssSelector = '.zone-container'
    for (let index = 0; index < this.#tags.length; index++) {
      const tag = this.#tags[index]
      await page.type(cssSelector, '#' + tag)
      await page.press(cssSelector, 'Space')
    }
    logger.info(`[抖音] 总共添加${this.#tags.length}个话题`)

    while (true) {
      // 判断重新上传按钮是否存在，如果不存在，代表视频正在上传，则等待
      try {
        //  新版：定位重新上传
        const number = await page.locator('[class^="long-card"] div:has-text("重新上传")').count()
        if (number > 0) {
          logger.info('[抖音] [+] 视频上传完毕')
          break
        }
        else {
          logger.info('[抖音] [-] 正在上传视频中...')
          await sleep(2000)

          if (await page.locator('div.progress-div > div:has-text("上传失败")').count()) {
            logger.error('[抖音] [-] 发现上传出错了... 准备重试')
            await this.handelUploadError(page)
          }
        }
      }
      catch {
        logger.info('[抖音] [-] 正在上传视频中...')
        await sleep(2000)
      }
    }

    // 頭條/西瓜
    const thirdPartElement = '[class^="info"] > [class^="first-part"] div div.semi-switch'
    // 定位是否有第三方平台
    if (await page.locator(thirdPartElement).count()) {
      // 检测是否是已选中状态
      const selectItems = await page.$eval(thirdPartElement, div => div.className) as string[]
      if (!selectItems.includes('semi-switch-checked')) {
        await page.locator(thirdPartElement).locator('input.semi-switch-native-control').click()
      }
    }

    // 判断视频是否发布成功
    while (true) {
      // 判断视频是否发布成功
      try {
        const publishButton = page.getByRole('button', { name: '发布', exact: true })
        if (await publishButton.count()) {
          await publishButton.click()
        }
        await page.waitForURL('https://creator.douyin.com/creator-micro/content/manage**', { timeout: 3000 }) // 如果自动跳转到作品页面，则代表发布成功
        logger.info('[抖音] [+]视频发布成功')
        break
      }
      catch {
        logger.info('[抖音] [-] 视频正在发布中...')
        await page.screenshot({ fullPage: true })
        await sleep(500)
      }
    }

    await context.storageState({ path: this.#accountFile })
    logger.info('[抖音] [+]cookie更新完毕！')
    await context.close()
    await browser.close()
  }
}
