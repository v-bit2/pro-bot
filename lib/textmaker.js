import sharp from "sharp";

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

export async function generateTextmakerImage(style, text) {
  const preset = PRESETS[style?.toLowerCase()] || PRESETS.neon;
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
