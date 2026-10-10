import mumaker from "mumaker";
import sharp from "sharp";

const MAX_CONCURRENT = 3;
let activeRequests = 0;
const cache = new Map();

export const TEXTMAKER_EFFECTS = {
  "1917": "https://en.ephoto360.com/1917-style-text-effect-523.html",
  "arena": "https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html",
  "blackpink": "https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html",
  "devil": "https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html",
  "fire": "https://en.ephoto360.com/flame-lettering-effect-372.html",
  "glitch": "https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html",
  "hacker": "https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html",
  "ice": "https://en.ephoto360.com/ice-text-effect-online-101.html",
  "impressive": "https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html",
  "leaves": "https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html",
  "light": "https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html",
  "matrix": "https://en.ephoto360.com/matrix-text-effect-154.html",
  "metallic": "https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html",
  "neon": "https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html",
  "purple": "https://en.ephoto360.com/purple-text-effect-online-100.html",
  "sand": "https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html",
  "snow": "https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html",
  "thunder": "https://en.ephoto360.com/thunder-text-effect-online-97.html"
};

const PRESETS = {
  "1917": { bg: "#1a1612", color: "#d4a373", font: "Courier New" },
  "arena": { bg: "#0f172a", color: "#38bdf8", font: "Arial" },
  "blackpink": { bg: "#000000", color: "#ff77a9", font: "Impact" },
  "devil": { bg: "#180000", color: "#ff0000", font: "Impact" },
  "fire": { bg: "#1c0a00", color: "#ff5500", font: "Impact" },
  "glitch": { bg: "#0d0221", color: "#00f0ff", font: "Courier New" },
  "hacker": { bg: "#001100", color: "#00ff00", font: "Courier New" },
  "ice": { bg: "#001f3f", color: "#7fdbff", font: "Segoe UI" },
  "impressive": { bg: "#2d0036", color: "#e040fb", font: "Arial" },
  "leaves": { bg: "#002b11", color: "#2ecc71", font: "Georgia" },
  "light": { bg: "#ffffff", color: "#111111", font: "Segoe UI" },
  "matrix": { bg: "#000b00", color: "#00ff66", font: "Courier New" },
  "metallic": { bg: "#1f2421", color: "#dce1e3", font: "Arial" },
  "neon": { bg: "#080811", color: "#00ffff", font: "Arial" },
  "purple": { bg: "#1a002c", color: "#b300ff", font: "Arial" },
  "sand": { bg: "#2c2214", color: "#e6c280", font: "Georgia" },
  "snow": { bg: "#0f1c2e", color: "#ffffff", font: "Arial" },
  "thunder": { bg: "#090919", color: "#facc15", font: "Impact" }
};

async function generateSvgFallback(styleKey, text) {
  const preset = PRESETS[styleKey] || PRESETS.neon;
  const safeText = String(text || "VOLTRA").trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const svg = `<svg width="800" height="400" viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="400" fill="${preset.bg}"/>
    <circle cx="400" cy="200" r="300" fill="${preset.color}" opacity="0.08"/>
    <text x="400" y="220" font-family="${preset.font}, sans-serif" font-size="64" font-weight="bold" fill="${preset.color}" text-anchor="middle" letter-spacing="4">${safeText}</text>
  </svg>`;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Shared Textmaker generator using mumaker.ephoto with concurrency limits, URL validation, and caching.
 */
export async function generateTextmakerImage(style, text) {
  const styleKey = String(style || "neon").toLowerCase().trim();
  const effectUrl = TEXTMAKER_EFFECTS[styleKey];
  const safeText = String(text || "").trim();

  if (!effectUrl) {
    throw new Error(`Unknown textmaker effect '${styleKey}'.`);
  }
  if (!safeText) {
    throw new Error("Please provide text for the image effect.");
  }

  const cacheKey = `${styleKey}:${safeText}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  activeRequests++;
  try {
    const res = await Promise.race([
      mumaker.ephoto(effectUrl, safeText),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout from Ephoto360 service.")), 20000))
    ]);

    const imageUrl = res?.image || res?.url || (typeof res === "string" ? res : null);

    if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      const imgRes = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(15000)
      });

      if (imgRes.ok) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length > 0) {
          cache.set(cacheKey, buffer);
          setTimeout(() => cache.delete(cacheKey), 600000); // 10 min cache
          return buffer;
        }
      }
    }

    console.warn(`[Textmaker] Remote generation failed for ${styleKey}, using fallback image...`);
    return await generateSvgFallback(styleKey, safeText);
  } catch (err) {
    console.warn(`[Textmaker] Error generating ${styleKey} with mumaker (${err.message}), using fallback...`);
    return await generateSvgFallback(styleKey, safeText);
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}
