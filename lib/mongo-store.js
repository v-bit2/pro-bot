import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

let client = null;
let db = null;
const debounceTimers = new Map();

export async function getMongoClient(mongoUri) {
  if (!mongoUri || mongoUri.includes(":<db_password>@") || mongoUri.endsWith(":@drey.qptc9q8.mongodb.net/?appName=Drey")) {
    return null;
  }

  if (db) return db;

  try {
    console.log("[MONGO] Connecting...");
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db("voltra_mini");
    console.log("[MONGO] Connected");
    return db;
  } catch (err) {
    console.error("[MONGO] Connection failed:", err.message);
    db = null;
    return null;
  }
}

/**
 * Backup local session directory files to MongoDB document for session ID.
 */
export async function saveSessionToMongo(mongoUri, sessionId, sessionDir) {
  const database = await getMongoClient(mongoUri);
  if (!database) return;

  try {
    const files = await fs.readdir(sessionDir);
    const sessionFiles = {};

    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const content = await fs.readFile(filePath, "utf-8");
        sessionFiles[file] = content;
      }
    }

    const collection = database.collection("sessions");
    await collection.updateOne(
      { _id: sessionId },
      { $set: { _id: sessionId, sessionId, files: sessionFiles, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log(`[MONGO] Session backup complete: ${sessionId}`);
  } catch (err) {
    console.error(`[MONGO] Backup failed: ${sessionId} - ${err.message}`);
  }
}

/**
 * Debounced save to MongoDB to avoid excessive write operations.
 */
export function saveSessionToMongoDebounced(mongoUri, sessionId, sessionDir, delayMs = 2000) {
  if (debounceTimers.has(sessionId)) {
    clearTimeout(debounceTimers.get(sessionId));
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(sessionId);
    saveSessionToMongo(mongoUri, sessionId, sessionDir).catch(() => {});
  }, delayMs);

  debounceTimers.set(sessionId, timer);
}

/**
 * Restore session directory files from MongoDB document for session ID into local directory.
 */
export async function restoreSessionFromMongo(mongoUri, sessionId, sessionDir) {
  console.log(`[MONGO] Restoring session: ${sessionId}`);
  const database = await getMongoClient(mongoUri);
  if (!database) {
    console.log(`[MONGO] MongoDB unavailable, using local directory for ${sessionId}`);
    return false;
  }

  try {
    const collection = database.collection("sessions");
    const doc = await collection.findOne({ _id: sessionId }) || await collection.findOne({ sessionId });
    if (!doc || !doc.files) {
      console.log(`[MONGO] No stored MongoDB session found for ${sessionId}`);
      return false;
    }

    await fs.mkdir(sessionDir, { recursive: true });
    for (const [file, content] of Object.entries(doc.files)) {
      await fs.writeFile(path.join(sessionDir, file), content, "utf-8");
    }

    console.log(`[MONGO] Session restored: ${sessionId}`);
    return true;
  } catch (err) {
    console.error(`[MONGO] Restore failed: ${sessionId} - ${err.message}`);
    return false;
  }
}

/**
 * Delete session document from MongoDB on explicit logout.
 */
export async function deleteSessionFromMongo(mongoUri, sessionId) {
  const database = await getMongoClient(mongoUri);
  if (!database) return;

  try {
    const collection = database.collection("sessions");
    await collection.deleteOne({ _id: sessionId });
    await collection.deleteOne({ sessionId });
  } catch {}
}
