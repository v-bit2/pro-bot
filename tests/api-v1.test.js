import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import { createApiV1Router } from "../routes/api-v1.js";
import { clearInMemoryBotStore, getBotById, getBotsByOwnerPhone } from "../lib/bot-store.js";
import { generateManagementToken, generateSalt, hashManagementToken, verifyManagementToken } from "../lib/management-auth.js";
import { SessionManager } from "../lib/session-manager.js";

const TEST_CONFIG = {
  name: "Voltra Mini Test",
  port: 0,
  maxSessions: 10,
  sessionDir: "./test_sessions",
  mongoUri: ""
};

describe("Voltra Mini API v1 Test Suite", () => {
  let app;
  let server;
  let baseUrl;
  let manager;

  beforeEach(async () => {
    clearInMemoryBotStore();
    await fs.rm(TEST_CONFIG.sessionDir, { recursive: true, force: true }).catch(() => {});

    manager = new SessionManager(TEST_CONFIG);
    app = express();
    app.use(express.json());

    // Mount API v1 router
    app.use("/api/v1", createApiV1Router({ config: TEST_CONFIG, manager }));

    // Mount legacy health endpoint for regression testing
    app.get("/api/health", (_req, res) => {
      res.json({
        ok: true,
        name: TEST_CONFIG.name,
        uptime: Math.floor(process.uptime()),
        sessions: manager.count()
      });
    });

    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await fs.rm(TEST_CONFIG.sessionDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("Service Health Endpoint", () => {
    it("GET /api/v1/health returns 200 OK with minimal status", async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.status, "ok");
      assert.ok(json.timestamp);
      // Ensure no environment variables or credentials leaked
      assert.equal(json.mongoUri, undefined);
      assert.equal(json.env, undefined);
    });
  });

  describe("Cryptographic Token & Hashing Security", () => {
    it("generates 256-bit secure token and verifies correct timing-safe SHA-256 hash", () => {
      const token = generateManagementToken();
      assert.equal(token.length, 64);

      const salt = generateSalt();
      assert.equal(salt.length, 32);

      const hash = hashManagementToken(token, salt);
      assert.ok(hash);

      assert.equal(verifyManagementToken(token, salt, hash), true);
      assert.equal(verifyManagementToken("wrong_token", salt, hash), false);
      assert.equal(verifyManagementToken(token, "wrong_salt", hash), false);
    });
  });

  describe("Create Bot API (POST /api/v1/bots)", () => {
    it("creates a bot successfully with valid input", async () => {
      const payload = {
        name: "Test Voltra Bot",
        phoneNumber: "+263786624966",
        pairingMethod: "code"
      };

      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      assert.equal(res.status, 201);
      const json = await res.json();

      assert.equal(json.success, true);
      assert.ok(json.data.botId.startsWith("bot_"));
      assert.equal(json.data.name, "Test Voltra Bot");
      assert.equal(json.data.phoneNumber, "263786624966"); // Normalized
      assert.equal(json.data.status, "created");
      assert.ok(json.data.managementToken);
      assert.equal(json.data.managementToken.length, 64);
      assert.equal(json.data.pairingMethod, "code");
      assert.ok(json.data.createdAt);

      // Verify token hash is stored in DB, but plaintext token is not stored
      const bot = await getBotById("", json.data.botId);
      assert.ok(bot);
      assert.equal(bot.managementToken, undefined);
      assert.ok(bot.managementTokenHash);
      assert.ok(bot.managementTokenSalt);
    });

    it("rejects creation when name is missing or invalid", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", phoneNumber: "263786624966" })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "INVALID_INPUT");
    });

    it("rejects creation when phone number is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name", phoneNumber: "invalid_phone" })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "INVALID_INPUT");
    });

    it("rejects creation when pairing method is unsupported", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Valid Name", phoneNumber: "263786624966", pairingMethod: "bluetooth" })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "INVALID_INPUT");
    });

    it("allows creating unlimited bots for the same normalized phone number", async () => {
      const phone = "263711112222";

      // Create 5 bots under same phone number
      for (let i = 1; i <= 5; i++) {
        const res = await fetch(`${baseUrl}/api/v1/bots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Bot ${i}`, phoneNumber: phone })
        });
        assert.equal(res.status, 201);
      }

      const createdBots = await getBotsByOwnerPhone("", phone);
      assert.equal(createdBots.length, 5);
    });

    it("handles concurrent creation requests safely creating all bots without artificial limit errors", async () => {
      const phone = "263799998888";
      const requests = Array.from({ length: 5 }).map((_, i) =>
        fetch(`${baseUrl}/api/v1/bots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Concurrent Bot ${i}`, phoneNumber: phone })
        })
      );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      const createdCount = statuses.filter((s) => s === 201).length;
      assert.equal(createdCount, 5);

      const createdBots = await getBotsByOwnerPhone("", phone);
      assert.equal(createdBots.length, 5);
    });
  });

  describe("Protected Endpoints Auth & Security", () => {
    let botId;
    let managementToken;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Protected Test Bot", phoneNumber: "263786111222" })
      });
      const json = await res.json();
      botId = json.data.botId;
      managementToken = json.data.managementToken;
    });

    it("rejects status request without Authorization header", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/status`);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error.code, "UNAUTHORIZED");
    });

    it("rejects status request with invalid Bearer token", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/status`, {
        headers: { Authorization: "Bearer wrong_management_token_123" }
      });
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error.code, "UNAUTHORIZED");
    });

    it("rejects authorization attempting to access another bot's ID", async () => {
      // Create a second bot
      const res2 = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Other Bot", phoneNumber: "263786111222" })
      });
      const json2 = await res2.json();
      const botId2 = json2.data.botId;

      // Use bot1 token to access bot2 -> should fail
      const resAccess = await fetch(`${baseUrl}/api/v1/bots/${botId2}/status`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });
      assert.equal(resAccess.status, 401);
    });

    it("allows status request with correct Bearer token", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/status`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.botId, botId);
      assert.equal(json.data.status, "created");
      // Confirm no token hash or salt in status output
      assert.equal(json.data.managementTokenHash, undefined);
      assert.equal(json.data.managementTokenSalt, undefined);
    });
  });

  describe("Pairing API & Session Isolation (POST /api/v1/bots/:botId/pair)", () => {
    let botId;
    let managementToken;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Pairing Test Bot", phoneNumber: "263786333444", pairingMethod: "code" })
      });
      const json = await res.json();
      botId = json.data.botId;
      managementToken = json.data.managementToken;
    });

    it("rejects pairing request when phone number body mismatches registered bot phone", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ phoneNumber: "263700000000" })
      });

      assert.equal(res.status, 403);
      const json = await res.json();
      assert.equal(json.error.code, "UNAUTHORIZED");
    });

    it("prevents concurrent duplicate pairing operations on the same bot", async () => {
      // Mock pairBot to simulate ongoing operation
      manager.acquireLock(botId);

      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/pair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ method: "code" })
      });

      assert.equal(res.status, 409);
      const json = await res.json();
      assert.equal(json.error.code, "CONFLICT");

      manager.releaseLock(botId);
    });
  });

  describe("Regression & Message Handler Preservation", () => {
    it("preserves SessionManager count and legacy health check", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.ok, true);
      assert.equal(typeof json.sessions, "number");
    });
  });
});
