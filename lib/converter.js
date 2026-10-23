import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Convert input audio buffer to WhatsApp-compatible OGG Opus audio buffer using ffmpeg-static
 */
export async function toAudio(buffer, ext = "mp3") {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
    const outputPath = path.join(tmpDir, `output_${Date.now()}_${Math.random().toString(36).slice(2)}.opus`);

    fs.writeFileSync(inputPath, buffer);

    const command = `"${ffmpegPath}" -y -i "${inputPath}" -vn -c:a libopus -b:a 128k -ar 48000 -ac 1 -f ogg "${outputPath}"`;

    exec(command, (error) => {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      } catch {}

      if (error) {
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch {}
        return reject(error);
      }

      try {
        const outBuffer = fs.readFileSync(outputPath);
        try {
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch {}
        resolve(outBuffer);
      } catch (err) {
        reject(err);
      }
    });
  });
}
