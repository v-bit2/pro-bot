import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MongoClient, ServerApiVersion } from "mongodb";
import config from "../config.js";

const DEFAULT_MONGO_URI = process.env.MONGO_URI || config.mongoUri || "";
const DB_NAME = process.env.MONGO_DB || "voltra";
const COLL_NAME = process.env.MONGO_COLLECTION || "sessions";

// Hard limit per session document (Mongo doc max is 16MB; leave headroom).
const MAX_SESSION_BYTES = 14 * 1024 * 1024;

let _client = null;
let _coll = null;
let _connecting = null;

async function getCollection(customUri = null) {
  if (_coll) return _coll;
  if (_connecting) return _connecting;

  const mongoUri = customUri || DEFAULT_MONGO_URI;

  _connecting = (async () => {
    if (!mongoUri) {
      console.warn("[mongoStore] MONGO_URI missing");
      return null;
    }

    _client = new MongoClient(mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true
      },
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 15000
    });

    try {
      await _client.connect();
      await _client.db("admin").command({ ping: 1 });
      console.log("🗄️  MongoDB connected (session store)");
      _coll = _client.db(DB_NAME).collection(COLL_NAME);
      try {
        await _coll.createIndex({ updatedAt: 1 });
      } catch {}
      return _coll;
    } catch (err) {
      console.error("[mongoStore] Connection error:", err.message);
      _client = null;
      _coll = null;
      return null;
    }
  })();

  try {
    return await _connecting;
  } finally {
    _connecting = null;
  }
}

function isSessionRegistered(folder) {
  const credsFile = path.join(folder, "creds.json");
  if (!fs.existsSync(credsFile)) return false;
  try {
    const raw = fs.readFileSync(credsFile, "utf-8");
    const creds = JSON.parse(raw);
    return Boolean(creds?.registered || creds?.me?.id);
  } catch {
    return false;
  }
}

function readFolderToMap(folder) {
  const files = {};
  let totalBytes = 0;
  if (!fs.existsSync(folder)) return { files, totalBytes };

  const entries = fs.readdirSync(folder);
  for (const name of entries) {
    const full = path.join(folder, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    try {
      const buf = fs.readFileSync(full);
      files[name] = buf.toString("base64");
      totalBytes += buf.length;
    } catch {}
  }
  return { files, totalBytes };
}

function writeMapToFolder(folder, files) {
  if (!files || typeof files !== "object") return 0;
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  let n = 0;
  for (const [name, b64] of Object.entries(files)) {
    if (!name || typeof b64 !== "string") continue;
    if (name.includes("/") || name.includes("\\") || name.includes("..")) continue;
    try {
      fs.writeFileSync(path.join(folder, name), Buffer.from(b64, "base64"));
      n++;
    } catch (e) {
      console.warn(`[mongoStore] write ${name} failed: ${e.message}`);
    }
  }
  return n;
}

/**
 * Save db.json settings file to MongoDB collection
 */
export async function saveDbToMongo(dbFilePath, customUri = null) {
  try {
    const coll = await getCollection(customUri);
    if (!coll || !fs.existsSync(dbFilePath)) return false;
    const data = fs.readFileSync(dbFilePath, "utf-8");
    await coll.updateOne(
      { _id: "__system_db_settings__" },
      { $set: { content: data, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    console.error("[mongoStore] Failed to save db.json to Mongo:", err.message);
    return false;
  }
}

/**
 * Restore db.json settings file from MongoDB collection
 */
export async function restoreDbFromMongo(dbFilePath, customUri = null) {
  try {
    const coll = await getCollection(customUri);
    if (!coll) return false;
    const doc = await coll.findOne({ _id: "__system_db_settings__" });
    if (doc && doc.content) {
      fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
      fs.writeFileSync(dbFilePath, doc.content, "utf-8");
      console.log("♻️  [mongo] Restored system settings db.json from MongoDB");
      return true;
    }
  } catch (err) {
    console.error("[mongoStore] Failed to restore db.json from Mongo:", err.message);
  }
  return false;
}

/**
 * Restore one session's files from Mongo into folder.
 * Returns true if at least one file (specifically creds.json) was restored.
 */
export async function restoreSession(number, folder, customUri = null) {
  try {
    const coll = await getCollection(customUri);
    if (!coll) return false;
    const doc = await coll.findOne({ _id: String(number) });
    if (!doc || !doc.files) return false;
    const written = writeMapToFolder(folder, doc.files);
    const hasCreds = Boolean(doc.files["creds.json"]);
    if (written) {
      console.log(`♻️  [mongo] Restored ${written} file(s) for ${number}${hasCreds ? "" : " (no creds.json!)"}`);
    }
    return hasCreds;
  } catch (e) {
    console.error(`[mongoStore] restore ${number} failed:`, e.message);
    return false;
  }
}

/**
 * Restore every saved session from Mongo onto disk under sessionsRoot.
 * Returns an array of restored numbers.
 */
export async function restoreAllSessionsFromMongo(sessionsRoot, customUri = null) {
  try {
    const coll = await getCollection(customUri);
    if (!coll) return [];
    const cursor = coll.find({ _id: { $ne: "__system_db_settings__" } }, { projection: { _id: 1, files: 1 } });
    const restored = [];
    for await (const doc of cursor) {
      const number = String(doc._id || "");
      if (!number || number.startsWith("__")) continue;
      const folder = path.join(sessionsRoot, number);
      const written = writeMapToFolder(folder, doc.files || {});
      if (doc.files && doc.files["creds.json"] && isSessionRegistered(folder)) {
        restored.push(number);
        console.log(`♻️  [mongo] Pre-restored ${written} file(s) for ${number}`);
      } else if (doc.files && !isSessionRegistered(folder)) {
        // Clean up void/unpaired session document from MongoDB
        await coll.deleteOne({ _id: number }).catch(() => {});
        try {
          fs.rmSync(folder, { recursive: true, force: true });
        } catch {}
      }
    }
    return restored;
  } catch (e) {
    console.error("[mongoStore] restoreAll failed:", e.message);
    return [];
  }
}

/**
 * Upload the current contents of folder to Mongo, replacing the document ONLY if registered/paired.
 */
export async function saveSession(number, folder, customUri = null) {
  try {
    if (!isSessionRegistered(folder)) {
      return false;
    }

    const coll = await getCollection(customUri);
    if (!coll) return false;
    const { files, totalBytes } = readFolderToMap(folder);
    if (!Object.keys(files).length) return false;

    if (totalBytes > MAX_SESSION_BYTES) {
      console.warn(`[mongoStore] ${number} session ${totalBytes}B exceeds cap; trimming non-essential files`);
      const essential = new Set(["creds.json"]);
      const sorted = Object.entries(files)
        .filter(([k]) => !essential.has(k))
        .sort((a, b) => b[1].length - a[1].length);
      let bytes = totalBytes;
      while (bytes > MAX_SESSION_BYTES && sorted.length) {
        const [k, v] = sorted.shift();
        delete files[k];
        bytes -= v.length;
      }
    }

    await coll.updateOne(
      { _id: String(number) },
      { $set: { files, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (e) {
    console.error(`[mongoStore] save ${number} failed:`, e.message);
    return false;
  }
}

/**
 * Debounced/serialized save manager. One saver per number, coalesces bursts.
 */
const _pending = new Map();  // number -> timer
const _inflight = new Map(); // number -> Promise
const _redo = new Set();     // number -> needs another save after current

export function scheduleSave(number, folder, delayMs = 1500, customUri = null) {
  if (!isSessionRegistered(folder)) {
    return;
  }

  const key = String(number);
  if (_inflight.has(key)) {
    _redo.add(key);
    return;
  }
  if (_pending.has(key)) {
    clearTimeout(_pending.get(key));
  }
  const t = setTimeout(async () => {
    _pending.delete(key);
    const p = saveSession(key, folder, customUri).catch(() => false);
    _inflight.set(key, p);
    try {
      await p;
    } finally {
      _inflight.delete(key);
      if (_redo.has(key)) {
        _redo.delete(key);
        scheduleSave(key, folder, 500, customUri);
      }
    }
  }, delayMs);
  _pending.set(key, t);
}

/**
 * Periodic safety-net sweep: re-saves every active session folder.
 */
export function startPeriodicSync(sessionsRoot, intervalMs = 60000, customUri = null) {
  setInterval(() => {
    try {
      if (!fs.existsSync(sessionsRoot)) return;
      for (const e of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const num = String(e.name);
        if (!num) continue;
        const folder = path.join(sessionsRoot, e.name);
        if (!isSessionRegistered(folder)) {
          // Clean up void/unpaired session folders from disk
          try {
            fs.rmSync(folder, { recursive: true, force: true });
          } catch {}
          continue;
        }
        scheduleSave(num, folder, 200, customUri);
      }
    } catch (err) {
      console.warn("[mongoStore] periodic sync error:", err.message);
    }
  }, intervalMs).unref?.();
}

export async function deleteSession(number, customUri = null) {
  try {
    const coll = await getCollection(customUri);
    if (!coll) return;
    await coll.deleteOne({ _id: String(number) });
    console.log(`🗑️  [mongo] Deleted session ${number}`);
  } catch (e) {
    console.error(`[mongoStore] delete ${number} failed:`, e.message);
  }
}

export async function close() {
  try {
    await _client?.close();
  } catch {}
  _client = null;
  _coll = null;
}

// Aliases & backwards-compatibility exports
export const connectMongo = getCollection;
export const getMongoClient = getCollection;
export const restoreAuthFromMongo = restoreSession;
export const backupAuthToMongo = saveSession;
export const saveSessionToMongo = saveSession;
export const saveSessionToMongoDebounced = (uri, number, folder, delayMs) => scheduleSave(number, folder, delayMs, uri);
export const restoreSessionFromMongo = restoreSession;
export const deleteSessionFromMongo = deleteSession;
