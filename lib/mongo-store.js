import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MongoClient } from "mongodb";

const DEFAULT_MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = "voltra";
const SERVER_INSTANCE_ID = process.env.RAILWAY_REPLICA_ID || process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || `server_${os.hostname()}_${process.pid}`;

let mongoClient = null;
let mongoDb = null;
let sessionsCol = null;
let dedupCol = null;
let mongoConnectPromise = null;

const debounceTimers = new Map();
const backupQueues = new Map();
const BACKUP_DELAY = 2000;

export function getServerInstanceId() {
  return SERVER_INSTANCE_ID;
}

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
      const sessCol = db.collection("wa_sessions");
      const ddCol = db.collection("wa_msg_dedup");

      try {
        await sessCol.createIndex({ sessionId: 1 }, { unique: true });
        await sessCol.createIndex({ leaseUntil: 1 });
        await ddCol.createIndex({ msgKey: 1 }, { unique: true });
        await ddCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // TTL 24 hours
      } catch (idxErr) {
        console.warn("[MONGO] Index creation note:", idxErr.message);
      }

      mongoClient = client;
      mongoDb = db;
      sessionsCol = sessCol;
      dedupCol = ddCol;

      console.log(`✅ MongoDB connected: ${DB_NAME} (Instance: ${SERVER_INSTANCE_ID})`);
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

export async function getMongoClient(mongoUri = null) {
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

// ===================== SINGLE DOCUMENT BACKUP =====================

/**
 * Packs all session auth files into ONE single MongoDB document per session in `wa_sessions`.
 */
export async function backupAuthToMongo(sessionId, authDir, mongoUri = null) {
  if (!sessionId || !authDir) return false;

  const previous = backupQueues.get(sessionId) || Promise.resolve();

  const current = previous
    .catch(() => {})
    .then(async () => {
      const db = await connectMongo(mongoUri);
      if (!db || !sessionsCol) return false;

      const files = listFilesRecursive(authDir);
      const credsPath = path.join(authDir, "creds.json");

      if (!files.some((file) => file === credsPath) || !fs.existsSync(credsPath)) {
        console.warn(`⚠️ Skipping incomplete auth backup: ${sessionId}`);
        return false;
      }

      const filesData = {};
      for (const filePath of files) {
        const filename = relativeToAuthDir(authDir, filePath);
        const data = fs.readFileSync(filePath);
        filesData[filename] = data.toString("base64");
      }

      // Read creds object if possible
      let credsObj = null;
      try {
        const credsRaw = fs.readFileSync(credsPath, "utf-8");
        credsObj = JSON.parse(credsRaw);
      } catch {}

      const now = new Date();

      await sessionsCol.updateOne(
        { _id: sessionId },
        {
          $set: {
            _id: sessionId,
            sessionId,
            creds: credsObj,
            files: filesData,
            updatedAt: now,
            lastBackupBy: SERVER_INSTANCE_ID
          }
        },
        { upsert: true }
      );

      console.log(`💾 Single-document MongoDB backup complete: ${sessionId} (${Object.keys(filesData).length} files)`);
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
  if (debounceTimers.has(sessionId)) {
    clearTimeout(debounceTimers.get(sessionId));
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(sessionId);
    await saveSessionToMongo(mongoUri, sessionId, sessionDir);
  }, delayMs);

  debounceTimers.set(sessionId, timer);
  timer.unref?.();
}

// ===================== SINGLE DOCUMENT RESTORE =====================

/**
 * Restores session auth files from single document in `wa_sessions` collection.
 * Includes legacy migration from `wa_auth_files` or `sessions` if needed.
 */
export async function restoreAuthFromMongo(sessionId, authDir, mongoUri = null) {
  if (!sessionId || !authDir) return false;

  try {
    const db = await connectMongo(mongoUri);
    if (!db || !sessionsCol) return false;

    // 1. Fetch single document from wa_sessions
    let doc = await sessionsCol.findOne({ _id: sessionId }) || await sessionsCol.findOne({ sessionId });

    // 2. Migration: Check legacy collections if not found in wa_sessions
    if (!doc || !doc.files) {
      const authFilesCol = db.collection("wa_auth_files");
      const legacyDocs = await authFilesCol.find({ sessionId }).toArray();

      if (legacyDocs && legacyDocs.length > 0) {
        console.log(`[MONGO] Migrating legacy multi-document session to single document: ${sessionId}`);
        const filesData = {};
        for (const ldoc of legacyDocs) {
          if (ldoc.filename && ldoc.dataB64) {
            filesData[ldoc.filename] = ldoc.dataB64;
          }
        }
        if (filesData["creds.json"]) {
          doc = { _id: sessionId, sessionId, files: filesData };
          await sessionsCol.updateOne(
            { _id: sessionId },
            { $set: { _id: sessionId, sessionId, files: filesData, updatedAt: new Date() } },
            { upsert: true }
          );
        }
      }
    }

    if (!doc || !doc.files || Object.keys(doc.files).length === 0) {
      console.log(`ℹ️ No MongoDB session document found: ${sessionId}`);
      return false;
    }

    // Clean stale local session dir
    try {
      await fs.promises.rm(authDir, { recursive: true, force: true });
    } catch {}

    fs.mkdirSync(authDir, { recursive: true });

    let restored = 0;

    for (const [filename, dataB64] of Object.entries(doc.files)) {
      if (typeof dataB64 !== "string") continue;

      const outputPath = safeAuthPath(authDir, filename);
      const buffer = Buffer.from(dataB64, "base64");

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);
      restored++;
    }

    const credsPath = path.join(authDir, "creds.json");

    if (!fs.existsSync(credsPath)) {
      console.error(`❌ Restore incomplete: creds.json missing for ${sessionId}`);
      return false;
    }

    console.log(`♻️ MongoDB single-document restore complete: ${sessionId} (${restored} files restored)`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB restore failed [${sessionId}]:`, error.message);
    return false;
  }
}

export async function restoreSessionFromMongo(mongoUri, sessionId, sessionDir) {
  return await restoreAuthFromMongo(sessionId, sessionDir, mongoUri);
}

// ===================== DISTRIBUTED ATOMIC LEASE & FAILOVER =====================

/**
 * Atomically claim ownership lease for a session.
 * Lease duration default: 45 seconds (45000ms).
 */
export async function acquireLease(sessionId, ownerId = SERVER_INSTANCE_ID, leaseDurationMs = 45000, mongoUri = null) {
  const db = await connectMongo(mongoUri);
  if (!db || !sessionsCol) return false;

  const now = new Date();
  const expiresAt = new Date(Date.now() + leaseDurationMs);

  try {
    const res = await sessionsCol.findOneAndUpdate(
      {
        _id: sessionId,
        $or: [
          { ownerId: ownerId },
          { leaseUntil: { $exists: false } },
          { leaseUntil: null },
          { leaseUntil: { $lt: now } }
        ]
      },
      {
        $set: {
          _id: sessionId,
          sessionId,
          ownerId,
          leaseUntil: expiresAt,
          updatedAt: now
        }
      },
      { upsert: true, returnDocument: "after" }
    );

    const doc = res?.value || res;
    const isOwner = doc?.ownerId === ownerId;
    if (isOwner) {
      console.log(`👑 [Lease] Server '${ownerId}' acquired lease for session '${sessionId}' until ${expiresAt.toISOString()}`);
    }
    return isOwner;
  } catch (err) {
    console.error(`[Lease] Failed to acquire lease for ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Renew heartbeat lease timestamp for active owner.
 */
export async function renewLease(sessionId, ownerId = SERVER_INSTANCE_ID, leaseDurationMs = 45000, mongoUri = null) {
  const db = await connectMongo(mongoUri);
  if (!db || !sessionsCol) return false;

  const now = new Date();
  const expiresAt = new Date(Date.now() + leaseDurationMs);

  try {
    const res = await sessionsCol.updateOne(
      {
        _id: sessionId,
        ownerId: ownerId
      },
      {
        $set: {
          leaseUntil: expiresAt,
          updatedAt: now
        }
      }
    );

    return res.modifiedCount > 0 || res.matchedCount > 0;
  } catch (err) {
    console.error(`[Lease] Failed to renew lease for ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Release lease ownership on graceful session shutdown.
 */
export async function releaseLease(sessionId, ownerId = SERVER_INSTANCE_ID, mongoUri = null) {
  const db = await connectMongo(mongoUri);
  if (!db || !sessionsCol) return;

  try {
    await sessionsCol.updateOne(
      { _id: sessionId, ownerId: ownerId },
      { $unset: { ownerId: "", leaseUntil: "" } }
    );
    console.log(`[Lease] Released lease for ${sessionId} by ${ownerId}`);
  } catch {}
}

// ===================== DEDUPLICATION HELPER =====================

/**
 * Check and record incoming message processing atomically to prevent duplicate executions across servers.
 */
export async function isMessageProcessed(msgKey, mongoUri = null) {
  if (!msgKey) return false;

  const db = await connectMongo(mongoUri);
  if (!db || !dedupCol) return false;

  try {
    await dedupCol.insertOne({
      msgKey,
      processedBy: SERVER_INSTANCE_ID,
      createdAt: new Date()
    });
    return false; // Not processed before, recorded now
  } catch (err) {
    if (err.code === 11000) {
      return true; // Duplicate key error: already processed by another server
    }
    return false;
  }
}

// ===================== DELETE =====================

export async function deleteSessionFromMongo(mongoUri, sessionId) {
  if (!sessionId) return;
  try {
    const db = await connectMongo(mongoUri);
    if (!db) return;
    if (sessionsCol) await sessionsCol.deleteOne({ _id: sessionId });
    const authFilesCol = db.collection("wa_auth_files");
    const authMetaCol = db.collection("wa_auth_meta");
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
  sessionsCol = null;
  dedupCol = null;

  console.log("MongoDB connection closed");
}
