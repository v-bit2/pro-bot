import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function getMongoClient(mongoUri) {
  if (!mongoUri || mongoUri.includes(":<db_password>@") || mongoUri.endsWith(":@drey.qptc9q8.mongodb.net/?appName=Drey")) {
    return null;
  }

  if (db) return db;

  try {
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db("voltra_mini");
    console.log("[MongoStore] ✅ Connected to MongoDB session cluster");
    return db;
  } catch (err) {
    console.error("[MongoStore] MongoDB connection failed:", err.message);
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
      { sessionId },
      { $set: { sessionId, files: sessionFiles, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    console.error(`[MongoStore] Failed to backup session ${sessionId} to MongoDB:`, err.message);
  }
}

/**
 * Restore session directory files from MongoDB document for session ID into local directory.
 */
export async function restoreSessionFromMongo(mongoUri, sessionId, sessionDir) {
  const database = await getMongoClient(mongoUri);
  if (!database) return false;

  try {
    const collection = database.collection("sessions");
    const doc = await collection.findOne({ sessionId });
    if (!doc || !doc.files) return false;

    await fs.mkdir(sessionDir, { recursive: true });
    for (const [file, content] of Object.entries(doc.files)) {
      await fs.writeFile(path.join(sessionDir, file), content, "utf-8");
    }

    console.log(`[MongoStore] ✅ Restored session ${sessionId} from MongoDB`);
    return true;
  } catch (err) {
    console.error(`[MongoStore] Failed to restore session ${sessionId} from MongoDB:`, err.message);
    return false;
  }
}

/**
 * Delete session from MongoDB on logout.
 */
export async function deleteSessionFromMongo(mongoUri, sessionId) {
  const database = await getMongoClient(mongoUri);
  if (!database) return;

  try {
    const collection = database.collection("sessions");
    await collection.deleteOne({ sessionId });
  } catch {}
}
