import fs from "fs";
import { google } from "googleapis";
import logger from "../logger.ts";

export class YoutubeVideo {
  #title: string;
  #tags: string[];
  #filePath: string;
  #accountFile: string;
  #credentials: any;

  constructor(
    title: string,
    filePath: string,
    tags: string[],
    accountFile: string,
    credentialsPath: string
  ) {
    this.#title = title;
    this.#filePath = filePath;
    this.#tags = tags;
    this.#accountFile = accountFile;
    this.#credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  }

  async authenticate() {
    const { client_secret, client_id, redirect_uris } =
      this.#credentials.installed;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    // 检查本地是否已有 token
    if (fs.existsSync(this.#accountFile)) {
      oAuth2Client.setCredentials(
        JSON.parse(fs.readFileSync(this.#accountFile, "utf-8"))
      );
      return oAuth2Client;
    }

    // 没有 token，则生成授权 URL
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/youtube.upload"],
    });

    console.log("[YouTube] 请在浏览器中访问此 URL 授权：", authUrl);

    // 等用户手动复制授权码后，粘贴到命令行
    const readline = (await import("readline")).createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const code: string = await new Promise((resolve) => {
      readline.question("请输入授权码: ", (code) => {
        readline.close();
        resolve(code);
      });
    });

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(this.#accountFile, JSON.stringify(tokens));
    logger.info("[YouTube] ✅ 授权成功，token 已保存到 ");

    return oAuth2Client;
  }

  async upload() {
    const auth = await this.authenticate();
    const youtube = google.youtube({ version: "v3", auth });

    const res = await youtube.videos.insert({
      part: ["id", "snippet", "status"],
      requestBody: {
        snippet: {
          title: this.#title,
          description: this.#title,
          tags: this.#tags,
          categoryId: "25", // People & Blogs
        },
        status: {
          privacyStatus: "public", // public / unlisted / private
        },
      },
      media: {
        body: fs.createReadStream(this.#filePath), // 本地视频文件
      },
    });

    logger.info("[YouTube] ✅ 上传成功，视频ID：", res.data.id);
  }
}
