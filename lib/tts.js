import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Converts text into a WhatsApp-compatible OGG/Opus voice note buffer.
 */
export async function generateSpeechOgg(text, lang = "en") {
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("Please specify text to speak.");
  }

  const cleanText = text.trim();
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(cleanText)}&tl=${encodeURIComponent(lang)}`;

  console.log("[TTS] Generating audio for text:", cleanText.slice(0, 30));

  // 1. Fetch MP3 audio
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
  });

  if (!response.ok) {
    throw new Error(`TTS service returned status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error("Generated TTS audio is empty.");
  }

  const tempDir = os.tmpdir();
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const mp3Path = path.join(tempDir, `voltra_tts_${id}.mp3`);
  const oggPath = path.join(tempDir, `voltra_tts_${id}.ogg`);

  await fs.writeFile(mp3Path, inputBuffer);

  // 2. Convert MP3 to OGG/Opus using ffmpeg-static
  console.log("[TTS] Converting audio to OGG/Opus...");
  await new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      ["-y", "-i", mp3Path, "-c:a", "libopus", "-b:a", "32k", "-vbr", "on", oggPath],
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });

  // 3. Read converted OGG buffer & cleanup temp files
  const oggBuffer = await fs.readFile(oggPath);

  try {
    await fs.unlink(mp3Path).catch(() => {});
    await fs.unlink(oggPath).catch(() => {});
  } catch {}

  if (!oggBuffer || oggBuffer.length === 0) {
    throw new Error("Converted OGG/Opus voice note is empty.");
  }

  console.log("[TTS] Audio conversion complete, buffer size:", oggBuffer.length);
  return oggBuffer;
}
