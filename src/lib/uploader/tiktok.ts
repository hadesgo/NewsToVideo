import { chromium, Page, Locator, FrameLocator } from "playwright";
import fs from "node:fs";

import { sleep, setInitScript } from "src/utils/utils.ts";
import logger from "../logger.ts";

const cookieAuth = async (accountFile: string) => {
  const browser = await chromium.launch({ headless: true });
  let context = await browser.newContext({ storageState: accountFile });
  context = await setInitScript(context);
  // 创建一个新的页面
  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/tiktokstudio/upload?lang=en");
  await page.waitForLoadState("networkidle");
  try {
    const selectElements = await page.$$("select");
    for (const element of selectElements) {
      const className = await element.getAttribute("class");
      // 使用正则表达式匹配特定模式的 class 名称
      if (className && className.match(/tiktok-.*-SelectFormContainer.*/)) {
        logger.error("[Tiktok] [-] cookie expired");
        return false;
      }
    }
    logger.info("[Tiktok] [+] cookie valid");
  } catch (error) {
    logger.info("[Tiktok] [+] cookie valid");
    return true;
  } finally {
    await browser.close();
  }
};

export const tiktokSetup = async (accountFile: string, handle = false) => {
  if (!fs.existsSync(accountFile) || !(await cookieAuth(accountFile))) {
    if (!handle) {
      return false;
    }
    logger.info(
      "[Tiktok] [+] cookie file is not existed or expired. Now open the browser auto. Please login with your way(gmail phone, whatever, the cookie file will generated after login"
    );
    await getTiktokCookie(accountFile);
  }
  return true;
};

const getTiktokCookie = async (accountFile: string) => {
  const options = {
    args: ["--lang en-GB"],
    headless: false, // Set headless option here
  };
  // Make sure to run headed.
  const browser = await chromium.launch(options);
  // Setup context however you like.
  let context = await browser.newContext(); // Pass any options
  context = await setInitScript(context);
  // Pause the page, and start recording manually.
  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/login?lang=en");
  await page.pause();
  // 点击调试器的继续，保存cookie
  await context.storageState({ path: accountFile });
};

export class TikTokVideo {
  #title: string;
  #tags: string[];
  #filePath: string;
  #accountFile: string;
  #thumbnailPath: string;
  #locatorBase: Locator | FrameLocator | null;

  constructor(
    title: string,
    filePath: string,
    tags: string[],
    thumbnailPath: string,
    accountFile: string
  ) {
    this.#title = title;
    this.#filePath = filePath;
    this.#tags = tags;
    this.#accountFile = accountFile;
    this.#thumbnailPath = thumbnailPath;
    this.#locatorBase = null;
  }

  async handelUploadError(page: Page) {
    logger.info("[Tiktok] video upload error retrying.");
    const selectFileButton = this.#locatorBase?.locator(
      'button[aria-label="Select file"]'
    );
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      selectFileButton?.click(), // 触发文件选择
    ]);
    await fileChooser.setFiles(this.#filePath);
  }

  async upload() {
    // 使用 Chromium 浏览器启动一个浏览器实例
    const browser = await chromium.launch({
      headless: false,
      executablePath: process.env.LOCAL_CHROME_PATH,
    });
    // 创建一个浏览器上下文，使用指定的 cookie 文件
    const context = await browser.newContext({
      storageState: this.#accountFile,
    });
    // 创建一个新的页面
    const page = await context.newPage();

    await this.changeLanguage(page);
    await page.goto("https://www.tiktok.com/tiktokstudio/upload");
    logger.info(`[Tiktok] [+] Uploading-------${this.#title}.mp4`);
    await page.waitForURL("https://www.tiktok.com/tiktokstudio/upload", {
      timeout: 10000,
    });

    try {
      await page.waitForSelector(
        'iframe[data-tt="Upload_index_iframe"], div.upload-container',
        { timeout: 10000 }
      );
      logger.info(`[Tiktok] [-] Either iframe or div appeared.`);
    } catch (error) {
      logger.error(
        "[Tiktok] [-] Neither iframe nor div appeared within the timeout."
      );
    }

    await this.chooseBaseLocator(page);

    const uploadButton = this.#locatorBase?.locator(
      'button:has-text("Select video"):visible'
    );
    await uploadButton?.waitFor({ state: "visible" }); // 确保按钮可见

    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton?.click(), // 触发文件选择
    ]);

    await fileChooser.setFiles(this.#filePath);

    await this.addTitleTags(page);

    await this.detectUploadStatus(page);
    if (this.#thumbnailPath) {
      logger.info(`[Tiktok][+] Uploading thumbnail file ${this.#title}.png`);
      await this.uploadThumbnails(page);
    }

    await this.clickPublish(page);
    logger.info(`[Tiktok]video_id: ${await this.getLastVideoId(page)}`);

    await context.storageState({ path: this.#accountFile }); // save cookie
    logger.info("[Tiktok]  [-] update cookie!");
    await sleep(2 * 1000); // close delay for look the video status
    // close all
    await context.close();
    await browser.close();
  }

  async uploadThumbnails(page: Page) {
    await this.#locatorBase?.locator(".cover-container").click();
    await this.#locatorBase
      ?.locator(".cover-edit-container >> text=Upload cover")
      .click();
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      this.#locatorBase?.locator(".upload-image-upload-area").click(),
    ]);
    await fileChooser.setFiles(this.#thumbnailPath);
    await this.#locatorBase
      ?.locator("div.cover-edit-panel:not(.hide-panel)")
      .getByRole("button", { name: "Confirm" })
      .click();
    await page.waitForTimeout(3000);
  }

  async changeLanguage(page: Page) {
    // set the language to english
    await page.goto("https://www.tiktok.com");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('[data-e2e="nav-more-menu"]');
    // 已经设置为英文, 省略这个步骤
    if (
      (await page.locator('[data-e2e="nav-more-menu"]').textContent()) == "More"
    ) {
      return;
    }

    await page.locator('[data-e2e="nav-more-menu"]').click();
    await page.locator('[data-e2e="language-select"]').click();
    await page
      .locator("#creator-tools-selection-menu-header >> text=English (US)")
      .click();
  }

  async chooseBaseLocator(page: Page) {
    const iframeCount = await page
      .locator('iframe[data-tt="Upload_index_iframe"]')
      .count();
    if (iframeCount > 0) {
      this.#locatorBase = page.frameLocator('[data-tt="Upload_index_iframe"]');
    } else {
      this.#locatorBase = page.locator("body");
    }
  }

  async addTitleTags(page: Page) {
    const editorLocator = this.#locatorBase?.locator(
      "div.public-DraftEditor-content"
    );
    await editorLocator?.click();

    await page.keyboard.press("End");

    await page.keyboard.press("Control+A");

    await page.keyboard.press("Delete");

    await page.keyboard.press("End");

    await page.waitForTimeout(1000); // 等待1秒

    await page.keyboard.insertText(this.#title);
    await page.waitForTimeout(1000); // 等待1秒
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    // tag part
    for (let index = 0; index < this.#tags.length; index++) {
      const tag = this.#tags[index];
      logger.info(`[Tiktok] Setting the ${tag} tag ${index}`);
      await page.keyboard.press("End");
      await page.waitForTimeout(1000); // 等待1秒
      await page.keyboard.insertText("#" + tag + " ");
      await page.keyboard.press("Space");
      await page.waitForTimeout(1000); // 等待1秒

      await page.keyboard.press("Backspace");
      await page.keyboard.press("End");
    }
  }

  async detectUploadStatus(page: Page) {
    while (true) {
      try {
        if (
          (await this.#locatorBase
            ?.locator("div.button-group > button >> text=Post")
            .getAttribute("disabled")) == null
        ) {
          logger.info("[Tiktok]  [-]video uploaded.");
          break;
        } else {
          logger.info("[Tiktok]  [-] video uploading...");
          await sleep(2 * 1000);
          if (
            await this.#locatorBase
              ?.locator('button[aria-label="Select file"]')
              .count()
          ) {
            logger.info(
              "[Tiktok]  [-] found some error while uploading now retry..."
            );
            await this.handelUploadError(page);
          }
        }
      } catch (error) {
        logger.info("[Tiktok]  [-] video uploading...");
        await sleep(2 * 1000);
      }
    }
  }

  async clickPublish(page: Page) {
    while (true) {
      try {
        const publishButton = this.#locatorBase
          ?.locator("div.button-group button")
          .nth(0);
        if (await publishButton?.count()) {
          await publishButton?.click();
        }

        await page.waitForURL("https://www.tiktok.com/tiktokstudio/content", {
          timeout: 3000,
        });
        logger.info("[Tiktok]  [-] video published success");
        break;
      } catch (error) {
        logger.error(`[Tiktok]  [-] Exception: ${error}`);
        logger.info("[Tiktok]  [-] video publishing");
        await sleep(0.5 * 1000);
      }
    }
  }

  async getLastVideoId(page: Page) {
    await page.waitForSelector('div[data-tt="components_PostTable_Container"]');
    const videoListLocator = this.#locatorBase?.locator(
      'div[data-tt="components_PostTable_Container"] div[data-tt="components_PostInfoCell_Container"] a'
    );
    if (await videoListLocator?.count()) {
      const firstVideoObj = await videoListLocator?.nth(0).getAttribute("href");
      if (firstVideoObj) {
        const match = firstVideoObj.match(/video\/(\d+)/);
        return match ? match[1] : null;
      }
    }
  }
}
