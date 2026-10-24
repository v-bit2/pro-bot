import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import config from "../config.js";
import { restoreDbFromMongo, saveDbToMongo } from "./mongo-store.js";

const DB_PATH = path.resolve(process.env.DB_FILE || "./data/db.json");

const defaultData = {
  settings: {
    prefix: config.prefix || ".",
    botName: config.name || "Voltra Mini",
    mode: "public", // 'public' | 'self' | 'private'
    autoRead: false,
    autoTyping: false,
    autoReact: false,
    antiCall: false,
    antiDelete: false,
    autoViewStatus: false,
    botImage: "./assets/voltra-mini.jpg",
    menuImage: "./assets/voltra-mini.jpg",
    newsletterJid: ""
  },
  groupSettings: {}, // { [groupId]: { antilink: 'off'|'delete'|'warn'|'kick', welcome: false, goodbye: false } }
  sessionSettings: {}, // { [sessionId]: { pin: '12345678', antiCall: 'off'|'on'|'block', antiCallWhitelist: [], mode: 'public'|'private'|'self', prefix: '.', autoStatus: false, msgReaction: 'off'|'on', msgReactionEmoji: '🤖' } }
  warnings: {}, // { [groupId]: { [userId]: count } }
  userActivity: {} // { [userId]: { total: 0, commands: {}, firstSeen: timestamp, lastSeen: timestamp } }
};

let cache = null;
let saveTimer = null;

export function generate8DigitPin() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export async function initDb() {
  if (cache) return cache;

  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

    if (config.mongoUri) {
      await restoreDbFromMongo(DB_PATH, config.mongoUri);
    }

    if (fsSync.existsSync(DB_PATH)) {
      const content = await fs.readFile(DB_PATH, "utf-8");
      const parsed = JSON.parse(content);
      cache = {
        ...defaultData,
        ...parsed,
        settings: { ...defaultData.settings, ...(parsed.settings || {}) }
      };
    } else {
      cache = JSON.parse(JSON.stringify(defaultData));
      await saveDbNow();
    }
  } catch (err) {
    cache = JSON.parse(JSON.stringify(defaultData));
    await saveDbNow();
  }

  return cache;
}

export function getDb() {
  if (!cache) {
    cache = JSON.parse(JSON.stringify(defaultData));
  }
  return cache;
}

export async function saveDbNow() {
  if (!cache) return;
  try {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(cache, null, 2), "utf-8");
    if (config.mongoUri) {
      await saveDbToMongo(DB_PATH, config.mongoUri);
    }
  } catch (err) {
    console.error("[DB Error] Failed to save database:", err);
  }
}

export function saveDbDebounced() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDbNow();
  }, 1000);
}

// Helpers for settings
export function getSettings() {
  return getDb().settings;
}

export function updateSettings(updates) {
  const db = getDb();
  db.settings = { ...db.settings, ...updates };
  saveDbDebounced();
  return db.settings;
}

// Helpers for session settings
export function getSessionSettings(sessionId) {
  const db = getDb();
  if (!db.sessionSettings) db.sessionSettings = {};
  if (!db.sessionSettings[sessionId]) {
    db.sessionSettings[sessionId] = {
      pin: generate8DigitPin(),
      botName: config.botName || "Voltra MD",
      newsletterName: config.newsletterName || "VOLTRA MD",
      antiCall: db.settings?.antiCall ? "on" : "off",
      antiCallWhitelist: [],
      antiDelete: Boolean(db.settings?.antiDelete),
      mode: "public",
      prefix: config.prefix || ".",
      autoStatus: false,
      msgReaction: "off",
      msgReactionEmoji: "🤖"
    };
    saveDbDebounced();
  }
  return db.sessionSettings[sessionId];
}

export function updateSessionSettings(sessionId, updates) {
  const sessionCfg = getSessionSettings(sessionId);
  Object.assign(sessionCfg, updates);
  saveDbDebounced();
  return sessionCfg;
}

export function getGroupSettings(groupId) {
  const db = getDb();
  if (!db.groupSettings[groupId]) {
    db.groupSettings[groupId] = {
      antilink: "off",
      antiaudio: false,
      antifile: false,
      antisticker: false,
      antivideo: false,
      welcome: false,
      goodbye: false,
      welcomeText: "Welcome @user to {group}! Member count: {count}",
      goodbyeText: "Goodbye @user, we will miss you!"
    };
  }
  return db.groupSettings[groupId];
}

export function updateGroupSettings(groupId, updates) {
  const group = getGroupSettings(groupId);
  Object.assign(group, updates);
  saveDbDebounced();
  return group;
}

// Helpers for warnings
export function getWarnings(groupId, userId) {
  const db = getDb();
  return db.warnings[groupId]?.[userId] || 0;
}

export function addWarning(groupId, userId) {
  const db = getDb();
  if (!db.warnings[groupId]) db.warnings[groupId] = {};
  db.warnings[groupId][userId] = (db.warnings[groupId][userId] || 0) + 1;
  saveDbDebounced();
  return db.warnings[groupId][userId];
}

export function resetWarnings(groupId, userId) {
  const db = getDb();
  if (db.warnings[groupId]) {
    delete db.warnings[groupId][userId];
    saveDbDebounced();
  }
}

// Helpers for activity
export function recordActivity(userId, commandName) {
  const db = getDb();
  if (!db.userActivity[userId]) {
    db.userActivity[userId] = {
      total: 0,
      commands: {},
      firstSeen: Date.now(),
      lastSeen: Date.now()
    };
  }

  const user = db.userActivity[userId];
  user.total += 1;
  user.lastSeen = Date.now();
  user.commands[commandName] = (user.commands[commandName] || 0) + 1;

  saveDbDebounced();
  return user;
}

export function getUserActivity(userId) {
  const db = getDb();
  return db.userActivity[userId] || { total: 0, commands: {}, firstSeen: Date.now(), lastSeen: Date.now() };
}
