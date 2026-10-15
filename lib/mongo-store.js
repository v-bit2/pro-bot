import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const DEFAULT_MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = "voltra";

let mongoClient = null;
let mongoDb = null;
let authFilesCol = null;
let authMetaCol = null;
let mongoConnectPromise = null;

const backupTimers = new Map();
const backupQueues = new Map();

const BACKUP_DELAY = 2000;

// ===================== CONNECTION =====================

export async function connectMongo(customUri = null) {
  if (mongoDb) return mongoDb;
  if (mongoConnectPromise) return mongoConnectPromise;

  const uri = customUri || process.env.MONGO_URI || DEFAULT_MONGO_URI;

  mongoConnectPromise = (async () => {
    if (!uri) {
      console.warn("[MONGO] MONGO_URI environment variable is missing");
      return null;
    }

    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    });

    try {
      await client.connect();

      const db = client.db(DB_NAME);
      const files = db.collection("wa_auth_files");
      const meta = db.collection("wa_auth_meta");

      try {
        await files.createIndex(
          { sessionId: 1, filename: 1 },
          { unique: true }
        );
        await files.createIndex({ sessionId: 1, updatedAt: -1 });
        await meta.createIndex({ sessionId: 1 }, { unique: true });
      } catch (idxErr) {
        console.warn("[MONGO] Index creation note:", idxErr.message);
      }

      mongoClient = client;
      mongoDb = db;
      authFilesCol = files;
      authMetaCol = meta;

      console.log("✅ MongoDB connected:", DB_NAME);
      return db;
    } catch (error) {
      await client.close().catch(() => {});
      console.error("[MONGO] Connection error:", error.message);
      mongoDb = null;
      return null;
    }
  })();

  try {
    return await mongoConnectPromise;
  } finally {
    mongoConnectPromise = null;
  }
}

export async function getMongoClient(mongoUri) {
  return await connectMongo(mongoUri);
}

// ===================== FILE HELPERS =====================

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();

    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, item.name);

      if (item.isSymbolicLink()) continue;

      if (item.isDirectory()) {
        stack.push(fullPath);
      } else if (item.isFile() && item.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function relativeToAuthDir(authDir, fullPath) {
  return path.relative(authDir, fullPath).split(path.sep).join("/");
}

function safeAuthPath(authDir, filename) {
  if (
    typeof filename !== "string" ||
    !filename ||
    filename.includes("\\") ||
    path.posix.isAbsolute(filename)
  ) {
    throw new Error("Invalid authentication filename");
  }

  const root = path.resolve(authDir);
  const output = path.resolve(root, filename);
  const relative = path.relative(root, output);

  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Authentication path escapes session directory");
  }

  return output;
}

// ===================== BACKUP =====================

export async function backupAuthToMongo(sessionId, authDir, mongoUri = null) {
  if (!sessionId || !authDir) return false;

  const previous = backupQueues.get(sessionId) || Promise.resolve();

  const current = previous
    .catch(() => {})
    .then(async () => {
      const db = await connectMongo(mongoUri);
      if (!db || !authFilesCol || !authMetaCol) return false;

      const files = listFilesRecursive(authDir);
      const credsPath = path.join(authDir, "creds.json");

      if (!files.some((file) => file === credsPath) || !fs.existsSync(credsPath)) {
        console.warn(`⚠️ Skipping incomplete auth backup: ${sessionId}`);
        return false;
      }

      const snapshot = [];

      for (const filePath of files) {
        const filename = relativeToAuthDir(authDir, filePath);
        const data = fs.readFileSync(filePath);

        snapshot.push({
          sessionId,
          filename,
          dataB64: data.toString("base64"),
          updatedAt: new Date()
        });
      }

      const filenames = snapshot.map((item) => item.filename);

      if (snapshot.length) {
        await authFilesCol.bulkWrite(
          snapshot.map((doc) => ({
            updateOne: {
              filter: {
                sessionId: doc.sessionId,
                filename: doc.filename
              },
              update: { $set: doc },
              upsert: true
            }
          })),
          { ordered: false }
        );
      }

      await authFilesCol.deleteMany({
        sessionId,
        filename: { $nin: filenames }
      });

      await authMetaCol.updateOne(
        { sessionId },
        {
          $set: {
            sessionId,
            updatedAt: new Date(),
            authDirName: `auth_${sessionId}`,
            fileCount: snapshot.length
          }
        },
        { upsert: true }
      );

      console.log(`💾 MongoDB backup complete: ${sessionId} (${snapshot.length} files)`);
      return true;
    });

  backupQueues.set(sessionId, current);

  try {
    return await current;
  } catch (error) {
    console.error(`❌ MongoDB backup failed [${sessionId}]:`, error.message);
    return false;
  } finally {
    if (backupQueues.get(sessionId) === current) {
      backupQueues.delete(sessionId);
    }
  }
}

export async function saveSessionToMongo(mongoUri, sessionId, sessionDir) {
  return await backupAuthToMongo(sessionId, sessionDir, mongoUri);
}

export function saveSessionToMongoDebounced(mongoUri, sessionId, sessionDir, delayMs = BACKUP_DELAY) {
  if (backupTimers.has(sessionId)) {
    clearTimeout(backupTimers.get(sessionId));
  }

  const timer = setTimeout(async () => {
    backupTimers.delete(sessionId);
    await saveSessionToMongo(mongoUri, sessionId, sessionDir);
  }, delayMs);

  backupTimers.set(sessionId, timer);
  timer.unref?.();
}

// ===================== RESTORE =====================

export async function restoreAuthFromMongo(sessionId, authDir, mongoUri = null) {
  if (!sessionId || !authDir) return false;

  try {
    const db = await connectMongo(mongoUri);
    if (!db || !authFilesCol) return false;

    const docs = await authFilesCol
      .find({ sessionId })
      .project({ _id: 0, filename: 1, dataB64: 1 })
      .toArray();

    if (!docs.length) {
      console.log(`ℹ️ No MongoDB backup found: ${sessionId}`);
      return false;
    }

    fs.mkdirSync(authDir, { recursive: true });

    let restored = 0;

    for (const doc of docs) {
      const outputPath = safeAuthPath(authDir, doc.filename);

      if (typeof doc.dataB64 !== "string") {
        console.warn(`⚠️ Invalid backup data: ${doc.filename}`);
        continue;
      }

      const buffer = Buffer.from(doc.dataB64, "base64");

      if (buffer.toString("base64") !== doc.dataB64) {
        console.warn(`⚠️ Corrupt backup data: ${doc.filename}`);
        continue;
      }

      // Overwrite/sync to ensure remote host matches MongoDB snapshot
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      restored++;
    }

    const credsPath = path.join(authDir, "creds.json");

    if (!fs.existsSync(credsPath)) {
      console.error(`❌ Restore incomplete: creds.json missing for ${sessionId}`);
      return false;
    }

    console.log(`♻️ MongoDB restore complete: ${sessionId} (${restored} files restored)`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB restore failed [${sessionId}]:`, error.message);
    return false;
  }
}

export async function restoreSessionFromMongo(mongoUri, sessionId, sessionDir) {
  return await restoreAuthFromMongo(sessionId, sessionDir, mongoUri);
}

// ===================== DELETE =====================

export async function deleteSessionFromMongo(mongoUri, sessionId) {
  if (!sessionId) return;
  try {
    const db = await connectMongo(mongoUri);
    if (!db) return;
    if (authFilesCol) await authFilesCol.deleteMany({ sessionId });
    if (authMetaCol) await authMetaCol.deleteOne({ sessionId });
  } catch {}
}

// ===================== CLEAN SHUTDOWN =====================

export async function closeMongo() {
  for (const timer of backupTimers.values()) {
    clearTimeout(timer);
  }

  backupTimers.clear();

  await Promise.allSettled([...backupQueues.values()]);

  if (mongoClient) {
    await mongoClient.close();
  }

  mongoClient = null;
  mongoDb = null;
  authFilesCol = null;
  authMetaCol = null;

  console.log("MongoDB connection closed");
}
