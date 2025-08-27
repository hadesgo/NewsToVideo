import axios from "axios";
import fs from "fs";

import { sleep } from "src/utils/utils.ts";
import logger from "src/lib/logger.ts";

const base_url = "https://api-inference.modelscope.cn/";
const api_key = process.env.MODELSCOPE_API_KEY; // ModelScope Token

const common_headers = {
  Authorization: `Bearer ${api_key}`,
  "Content-Type": "application/json",
};

async function genImage(text: string, imageSize: string, imagePath: string) {
  // 1. 发起生成请求
  const response = await axios.post(
    `${base_url}v1/images/generations`,
    {
      model: "Qwen/Qwen-Image", // ModelScope Model-Id
      prompt: text,
      size: imageSize,
      negative_prompt:
        "blurry, pixelated, low resolution, grainy, noisy, out of focus, jagged edges, missing details,deformed hands/ face / limbs, extra fingers, asymmetrical features, incomplete objects, poor lighting, overexposed, underexposed, color distortion, washed-out colors, watermark, text, signature, compression artifacts, tiling patterns",
    },
    {
      headers: {
        ...common_headers,
        "X-ModelScope-Async-Mode": "true",
      },
    }
  );

  const task_id = response.data.task_id;

  // 2. 轮询任务状态
  while (true) {
    const result = await axios.get(`${base_url}v1/tasks/${task_id}`, {
      headers: {
        ...common_headers,
        "X-ModelScope-Task-Type": "image_generation",
      },
    });

    const data = result.data;

    if (data.task_status === "SUCCEED") {
      // 3. 下载图片并保存
      const imageUrl = data.output_images[0];
      const imgResponse = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      fs.writeFileSync(imagePath, imgResponse.data);
      logger.info(`"✅ Image saved as ${imagePath}"`);
      break;
    } else if (data.task_status === "FAILED") {
      logger.error("❌ Image Generation Failed.");
      break;
    }

    // 等待 5 秒再轮询
    await sleep(5000);
  }
}

export default genImage;
