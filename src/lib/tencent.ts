import { chromium, Page } from 'playwright'
import fs from 'fs'

import logger from './logger.ts'
import { setInitScript } from 'src/utils/utils.ts'
import { sleep } from 'src/utils/utils.ts'

function isAlnum(char: string) {
  // 检查字符是否为单个字符
  if (char.length !== 1) {
    return false
  }

  // 使用正则表达式检测是否为字母或数字
  return /^[a-zA-Z0-9]$/.test(char)
}

const formatStrForShortTitle = (originTitle: string) => {
  // 定义允许的特殊字符
  const allowedSpecialChars = '《》“”:+?%°'
  const filteredChars = []
  // 移除不允许的特殊字符
  for (let index = 0; index < originTitle.length; index++) {
    const char = originTitle[index]
    if (allowedSpecialChars.includes(char) || isAlnum(char)) {
      filteredChars.push(char)
    }
    else if (char === ',') {
      filteredChars.push('')
    }
    else {
      filteredChars.push(' ')
    }
  }
  let formattedString = filteredChars.join('')

  // 调整字符串长度
  if (formattedString.length > 16) {
    // 截断字符串
    formattedString = formattedString.substring(0, 16)
  }
  else if (formattedString.length < 6) {
    // 使用空格来填充字符串
    formattedString = formattedString + Array(6 - formattedString.length).fill(' ').join('')
  }

  return formattedString
}

const cookieAuth = async (accountFile: string) => {
  const browser = await chromium.launch({ headless: true })
  let context = await browser.newContext({ storageState: accountFile })
  context = await setInitScript(context)
  // 创建一个新的页面
  const page = await context.newPage()
  // 访问指定的 URL
  await page.goto('https://channels.weixin.qq.com/platform/post/create')
  try {
    await page.waitForSelector('div.title-name:has-text("微信小店")', { timeout: 5000 }) // 等待5秒
    logger.error('[视频号] [+] 等待5秒 cookie 失效')
    return false
  }
  catch {
    logger.info('[视频号] [+] cookie 有效')
    return true
  }
}

const getTencentCookie = async (accountFile: string) => {
  const options = {
    args: ['--lang en-GB'],
    headless: false,
  }
  // Make sure to run headed.
  const browser = await chromium.launch(options)
  // Setup context however you like.
  let context = await browser.newContext() // Pass any options
  // Pause the page, and start recording manually.
  context = await setInitScript(context)
  const page = await context.newPage()
  await page.goto('https://channels.weixin.qq.com')
  await page.pause()
  // 点击调试器的继续，保存cookie
  await context.storageState({ path: accountFile })
}

export const weixinSetup = async (accountFile: string, handle = false) => {
  if (!fs.existsSync(accountFile) || !await cookieAuth(accountFile)) {
    if (!handle) {
      // Todo alert message
      return false
    }
    logger.info('[+] cookie文件不存在或已失效，即将自动打开浏览器，请扫码登录，登陆后会自动生成cookie文件')
    await getTencentCookie(accountFile)
  }
  return true
}

export class TencentVideo {
  #title: string
  #tags: string[]
  #filePath: string
  #accountFile: string
  #category: string

  constructor(title: string, filePath: string, tags: string[], accountFile: string, category: string = '') {
    this.#title = title
    this.#filePath = filePath
    this.#tags = tags
    this.#accountFile = accountFile
    this.#category = category
  }

  async handleUploadError(page: Page) {
    logger.info('[视频号] 视频出错了，重新上传中')
    await page.locator('div.media-status-content div.tag-inner:has-text("删除")').click()
    await page.getByRole('button', { name: '删除', exact: true }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(this.#filePath)
  }

  async upload() {
    // 使用 Chromium (这里使用系统内浏览器，用chromium 会造成h264错误
    const browser = await chromium.launch({ headless: false, executablePath: process.env.LOCAL_CHROME_PATH })
    // 创建一个浏览器上下文，使用指定的 cookie 文件
    let context = await browser.newContext({ storageState: this.#accountFile })
    context = await setInitScript(context)

    // 创建一个新的页面
    const page = await context.newPage()
    // 访问指定的 URL
    await page.goto('https://channels.weixin.qq.com/platform/post/create')
    logger.info(`[视频号] [+]正在上传-------${this.#title}.mp4`)
    // 等待页面跳转到指定的 URL，没进入，则自动等待到超时
    await page.waitForURL('https://channels.weixin.qq.com/platform/post/create')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(this.#filePath)
    // 填充标题和话题
    await this.addTitleTags(page)
    // 添加商品
    // await this.addProduct(page)
    // 合集功能
    await this.addCollection(page)
    // 原创选择
    await this.addOriginal(page)
    // 检测上传状态
    await this.detectUploadStatus(page)
    // 添加短标题
    await this.addShortTitle(page)

    await this.clickPublish(page)

    await context.storageState({ path: this.#accountFile }) // 保存cookie
    logger.info('[视频号] [-]cookie更新完毕！')
    // 关闭浏览器上下文和浏览器实例
    await context.close()
    await browser.close()
  }

  async addShortTitle(page: Page) {
    const shortTitleElement = page.getByText('短标题', { exact: true }).locator('..')
      .locator('xpath=following-sibling::div').locator('span input[type="text"]')
    if (await shortTitleElement.count()) {
      const shortTitle = formatStrForShortTitle(this.#title)
      await shortTitleElement.fill(shortTitle)
    }
  }

  async clickPublish(page: Page) {
    while (true) {
      try {
        const publishButtion = page.locator('div.form-btns button:has-text("发表")')
        if (await publishButtion.count()) {
          await publishButtion.click()
        }
        await page.waitForURL('https://channels.weixin.qq.com/platform/post/list', { timeout: 1500 })
        logger.info('[视频号] [-]视频发布成功')
        break
      }
      catch (error) {
        const currentUrl = page.url()
        if (currentUrl.includes('https://channels.weixin.qq.com/platform/post/list')) {
          logger.info('[视频号] [-]视频发布成功')
          break
        }
        else {
          logger.error(`[视频号] [-] Exception: ${error}`)
          logger.info('[视频号] [-] 视频正在发布中...')
          await sleep(500)
        }
      }
    }
  }

  async detectUploadStatus(page: Page) {
    while (true) {
      // 匹配删除按钮，代表视频上传完毕，如果不存在，代表视频正在上传，则等待
      try {
        // 匹配删除按钮，代表视频上传完毕
        const publishButtion = await page.getByRole('button', { name: '发表' }).getAttribute('class')
        if (!publishButtion?.includes('weui-desktop-btn_disabled')) {
          logger.info('[视频号] [-]视频上传完毕')
          break
        }
        else {
          logger.info('[视频号] [-] 正在上传视频中...')
          await sleep(2000)
          // 出错了视频出错
          if (await page.locator('div.status-msg.error').count()
            && await page.locator('div.media-status-content div.tag-inner:has-text("删除")').count()) {
            logger.error('[视频号] [-] 发现上传出错了...准备重试')
            await this.handleUploadError(page)
          }
        }
      }
      catch {
        logger.info('[视频号] [-] 视频正在发布中...')
        await sleep(2000)
      }
    }
  }

  async addTitleTags(page: Page) {
    await page.locator('div.input-editor').click()
    await page.keyboard.type(this.#title)
    await page.keyboard.press('Enter')
    for (let index = 0; index < this.#tags.length; index++) {
      const tag = this.#tags[index]
      await page.keyboard.type('#' + tag)
      await page.keyboard.press('Space')
    }
    logger.info(`[视频号] 成功添加hashtag: ${this.#tags.length}`)
  }

  async addCollection(page: Page) {
    const collectionElements = page.getByText('添加到合集').locator('xpath=following-sibling::div').locator(
      '.option-list-wrap > div')
    if (await collectionElements.count() > 1) {
      await page.getByText('添加到合集').locator('xpath=following-sibling::div').click()
      await collectionElements.first().click()
    }
  }

  async addOriginal(page: Page) {
    if (await page.getByLabel('视频为原创').count()) {
      await page.getByLabel('视频为原创').check()
    }
    // 检查 "我已阅读并同意 《视频号原创声明使用条款》" 元素是否存在
    const labelLocator = await page.locator('label:has-text("我已阅读并同意 《视频号原创声明使用条款》")').isVisible()
    if (labelLocator) {
      await page.getByLabel('我已阅读并同意 《视频号原创声明使用条款》').check()
      await page.getByRole('button', { name: '声明原创' }).click()
    }
    // 2023年11月20日 wechat更新: 可能新账号或者改版账号，出现新的选择页面
    if (await page.locator('div.label span:has-text("声明原创")').count() && this.#category) {
      // 因处罚无法勾选原创，故先判断是否可用
      if (!await page.locator('div.declare-original-checkbox input.ant-checkbox-input').isDisabled()) {
        await page.locator('div.declare-original-checkbox input.ant-checkbox-input').click()
        if (!await page.locator(
          'div.declare-original-dialog label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked:visible').count()) {
          await page.locator('div.declare-original-dialog input.ant-checkbox-input:visible').click()
        }
      }
      if (await page.locator('div.original-type-form > div.form-label:has-text("原创类型"):visible').count()) {
        await page.locator('div.form-content:visible').click() // 下拉菜单
        await page.locator(
          `'div.form-content:visible ul.weui-desktop-dropdown__list li.weui-desktop-dropdown__list-ele:has-text("${this.#category}")`).first().click()
        await page.waitForTimeout(1000)
      }
      if (await page.locator('button:has-text("声明原创"):visible').count()) {
        await page.locator('button:has-text("声明原创"):visible').click()
      }
    }
  }
}
