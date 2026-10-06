import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsDir = path.join(__dirname, "..", "commands");

let commandMap = new Map();
let aliasMap = new Map();
let loaded = false;

/**
 * Automatically load all command modules from the commands/ directory.
 */
export async function loadCommands(reload = false) {
  if (loaded && !reload) {
    return { commandMap, aliasMap };
  }

  commandMap.clear();
  aliasMap.clear();

  try {
    const files = (await fs.readdir(commandsDir)).filter(file => file.endsWith(".js"));

    for (const file of files) {
      try {
        const filePath = path.join(commandsDir, file);
        // Use query string to break cache if reloading
        const fileUrl = pathToFileURL(filePath).href + (reload ? `?v=${Date.now()}` : "");
        const mod = await import(fileUrl);
        const cmd = mod.command;

        if (!cmd || typeof cmd !== "object" || !cmd.name) {
          console.warn(`[CommandLoader] Skipping invalid command file: ${file}`);
          continue;
        }

        if (cmd.enabled === false) {
          console.log(`[CommandLoader] Command disabled: ${cmd.name}`);
          continue;
        }

        const name = cmd.name.toLowerCase();
        cmd.category = (cmd.category || "GENERAL").toUpperCase();
        cmd.description = cmd.description || "No description provided";
        cmd.usage = cmd.usage || `.${name}`;
        cmd.aliases = Array.isArray(cmd.aliases) ? cmd.aliases.map(a => a.toLowerCase()) : [];

        commandMap.set(name, cmd);

        for (const alias of cmd.aliases) {
          if (aliasMap.has(alias)) {
            console.warn(`[CommandLoader] Alias '${alias}' in ${file} overrides existing mapping.`);
          }
          aliasMap.set(alias, name);
        }
      } catch (err) {
        console.error(`[CommandLoader] Error loading command file ${file}:`, err);
      }
    }

    loaded = true;
    console.log(`[CommandLoader] Loaded ${commandMap.size} commands and ${aliasMap.size} aliases.`);
  } catch (err) {
    console.error("[CommandLoader] Failed to read commands directory:", err);
  }

  return { commandMap, aliasMap };
}

/**
 * Find a command by name or alias.
 */
export function getCommand(nameOrAlias) {
  if (!nameOrAlias) return null;
  const key = nameOrAlias.toLowerCase();
  if (commandMap.has(key)) return commandMap.get(key);
  const realName = aliasMap.get(key);
  if (realName && commandMap.has(realName)) return commandMap.get(realName);
  return null;
}

/**
 * Get all loaded commands grouped by category.
 */
export function getCommandsByCategory() {
  const categories = {};

  for (const cmd of commandMap.values()) {
    const cat = cmd.category || "GENERAL";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd);
  }

  return categories;
}

/**
 * Get list of all loaded command objects.
 */
export function getAllCommands() {
  return Array.from(commandMap.values());
}
