import axios from "axios";

import { sleep, downloadFile } from "src/utils/utils.ts";
import { MAX_RETRY_COUNT } from "src/constant.ts";

const URL = "https://api.siliconflow.cn/v1/images/generations";
const API_KEY = process.env.SILICONFLOW_API_KEY;

const genImage = async (text: string, imageSize: string, imagePath: string) => {
  let retryCount = 0;
  let networkError = null;
  while (retryCount < MAX_RETRY_COUNT) {
    try {
      const postBody = {
        model: "Kwai-Kolors/Kolors",
        prompt: text,
        image_size: imageSize,
        negative_prompt:
          "blurry, pixelated, low resolution, grainy, noisy, out of focus, jagged edges, missing details,deformed hands/ face / limbs, extra fingers, asymmetrical features, incomplete objects, poor lighting, overexposed, underexposed, color distortion, washed-out colors, watermark, text, signature, compression artifacts, tiling patterns",
      };
      const res = await axios.post(URL, postBody, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      const imageUrl = res.data.images[0].url;
      await downloadFile(imageUrl, imagePath);
      return imagePath;
    } catch (error) {
      networkError = error;
      retryCount += 1;
      await sleep(1000 * 60);
    }
  }
  throw networkError;
};

export default genImage;
