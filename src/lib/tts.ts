import { addSilence } from "src/utils/ffmpeg.ts";
import { MAX_RETRY_COUNT } from "src/constant.ts";
import { sleep } from "src/utils/utils.ts";
import { EdgeTTS } from "src/edge-tts/edgtTTS.ts";

// Initialize the EdgeTTS service
const edgeTTS = new EdgeTTS();

const tts = async (text: string, outputPath: string) => {
  let retryCount = 0;
  let networkError = null;
  while (retryCount < MAX_RETRY_COUNT) {
    try {
      await edgeTTS.synthesize(text, "zh-CN-XiaoxiaoMultilingualNeural");
      edgeTTS.toFile(outputPath.replace(".mp3", ""));
      await addSilence(outputPath, 0.3);
      return {
        audio: outputPath,
      };
    } catch (error) {
      networkError = error;
      retryCount += 1;
      await sleep(3000);
    }
  }
  throw networkError;
};

export default tts;
