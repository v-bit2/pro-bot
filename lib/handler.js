import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsDir = path.join(__dirname, "..", "commands");

let commandCache = null;

async function loadCommands() {
  if (commandCache) return commandCache;

  commandCache = new Map();
  const files = (await fs.readdir(commandsDir)).filter(file => file.endsWith(".js"));

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(commandsDir, file)).href);
    if (mod.command?.name) {
      commandCache.set(mod.command.name.toLowerCase(), mod.command);
    }
  }

  return commandCache;
}

function getText(message) {
  const m = message.message;
  if (!m) return "";

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  ).trim();
}

export async function handleMessage(sock, message, config) {
  if (!message?.message || message.key?.fromMe) return;

  const text = getText(message);
  if (!text.startsWith(config.prefix)) return;

  const parts = text.slice(config.prefix.length).trim().split(/\s+/);
  const name = (parts.shift() || "").toLowerCase();
  if (!name) return;

  const commands = await loadCommands();
  const command = commands.get(name);

  if (!command) return;

  const args = parts;
  const ctx = {
    sock,
    message,
    args,
    text,
    prefix: config.prefix,
    command: name,
    reply: async content => sock.sendMessage(message.key.remoteJid, { text: content }, { quoted: message }),
    isGroup: message.key.remoteJid?.endsWith("@g.us")
  };

  await command.execute(ctx);
}
