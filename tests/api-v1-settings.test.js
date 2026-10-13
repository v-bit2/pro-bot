import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs/promises";
import { createApiV1Router } from "../routes/api-v1.js";
import { clearInMemoryBotStore, getBotById } from "../lib/bot-store.js";
import { SessionManager } from "../lib/session-manager.js";
import { WhatsAppSession } from "../lib/whatsapp-session.js";

const TEST_CONFIG = {
  name: "Voltra Mini Settings Test",
  port: 0,
  maxSessions: 10,
  sessionDir: "./test_settings_sessions",
  mongoUri: ""
};

describe("Voltra Mini API v1 Settings & Management Test Suite", () => {
  let app;
  let server;
  let baseUrl;
  let manager;
  let originalConnect;
  let originalLogout;

  beforeEach(async () => {
    clearInMemoryBotStore();
    await fs.rm(TEST_CONFIG.sessionDir, { recursive: true, force: true }).catch(() => {});

    // Mock WhatsAppSession network calls to prevent hanging background socket timers
    originalConnect = WhatsAppSession.prototype.connect;
    originalLogout = WhatsAppSession.prototype.logout;

    WhatsAppSession.prototype.connect = async function() {
      this.status = "connected";
      this.registered = true;
      this.onStatusChange?.("connected");
      return { ev: { on: () => {} } };
    };

    WhatsAppSession.prototype.logout = async function() {
      this.status = "disconnected";
      this.sock = null;
      this.onStatusChange?.("disconnected");
    };

    manager = new SessionManager(TEST_CONFIG);
    app = express();
    app.use(express.json());
    app.use("/api/v1", createApiV1Router({ config: TEST_CONFIG, manager }));

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
    WhatsAppSession.prototype.connect = originalConnect;
    WhatsAppSession.prototype.logout = originalLogout;
    await fs.rm(TEST_CONFIG.sessionDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("Owner Bot Listing (GET /api/v1/bots)", () => {
    it("lists all bots owned by the authenticated owner", async () => {
      const phone = "263788111222";

      const res1 = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bot One", phoneNumber: phone })
      });
      const b1 = (await res1.json()).data;

      const res2 = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Bot Two", phoneNumber: phone })
      });
      const b2 = (await res2.json()).data;

      const resList = await fetch(`${baseUrl}/api/v1/bots?botId=${b1.botId}`, {
        headers: { Authorization: `Bearer ${b1.managementToken}` }
      });

      assert.equal(resList.status, 200);
      const jsonList = await resList.json();
      assert.equal(jsonList.success, true);
      assert.equal(Array.isArray(jsonList.data), true);
      assert.equal(jsonList.data.length, 2);

      const botIds = jsonList.data.map((b) => b.botId);
      assert.ok(botIds.includes(b1.botId));
      assert.ok(botIds.includes(b2.botId));
    });

    it("rejects bot listing when Bearer token is missing or invalid", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error.code, "UNAUTHORIZED");
    });
  });

  describe("Bot Details & Settings (GET/PATCH /api/v1/bots/:botId/settings)", () => {
    let botId;
    let managementToken;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Configurable Bot", phoneNumber: "263788333444" })
      });
      const json = await res.json();
      botId = json.data.botId;
      managementToken = json.data.managementToken;
    });

    it("retrieves bot details including settings", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.botId, botId);
      assert.equal(json.data.name, "Configurable Bot");
      assert.ok(json.data.settings);
      assert.equal(json.data.settings.prefix, ".");
      assert.equal(json.data.settings.mode, "public");
    });

    it("retrieves bot settings and supported options list", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/settings`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.settings);
      assert.ok(Array.isArray(json.data.supportedOptions));
      assert.ok(json.data.supportedOptions.includes("prefix"));
      assert.ok(json.data.supportedOptions.includes("mode"));
    });

    it("updates supported settings successfully", async () => {
      const resPatch = await fetch(`${baseUrl}/api/v1/bots/${botId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({
          prefix: "!",
          mode: "self",
          autoTyping: true,
          autoRead: true
        })
      });

      assert.equal(resPatch.status, 200);
      const jsonPatch = await resPatch.json();
      assert.equal(jsonPatch.success, true);
      assert.equal(jsonPatch.data.settings.prefix, "!");
      assert.equal(jsonPatch.data.settings.mode, "self");
      assert.equal(jsonPatch.data.settings.autoTyping, true);
      assert.equal(jsonPatch.data.settings.autoRead, true);

      // Verify persisted retrieval
      const resGet = await fetch(`${baseUrl}/api/v1/bots/${botId}/settings`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });
      const jsonGet = await resGet.json();
      assert.equal(jsonGet.data.settings.prefix, "!");
      assert.equal(jsonGet.data.settings.mode, "self");
    });

    it("rejects unsupported or internal setting keys", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({
          managementTokenHash: "hacked_hash",
          sessionId: "fake_session"
        })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
    });

    it("rejects invalid setting values", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({
          mode: "invalid_mode_option"
        })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
    });
  });

  describe("Bot Actions Dispatcher (POST /api/v1/bots/:botId/actions)", () => {
    let botId;
    let managementToken;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Action Test Bot", phoneNumber: "263788555666" })
      });
      const json = await res.json();
      botId = json.data.botId;
      managementToken = json.data.managementToken;
    });

    it("executes valid 'disconnect' action", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ action: "disconnect" })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.action, "disconnect");
      assert.equal(json.data.status, "disconnected");
    });

    it("executes valid 'reconnect' action", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ action: "reconnect" })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.action, "reconnect");
      assert.equal(json.data.status, "connecting");
    });

    it("rejects unsupported action strings", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ action: "shutdown_server" })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
    });
  });

  describe("Permanent Bot Deletion (DELETE /api/v1/bots/:botId)", () => {
    let botId;
    let managementToken;

    beforeEach(async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Deletion Test Bot", phoneNumber: "263788777888" })
      });
      const json = await res.json();
      botId = json.data.botId;
      managementToken = json.data.managementToken;
    });

    it("rejects deletion without explicit confirmation in request body", async () => {
      const res = await fetch(`${baseUrl}/api/v1/bots/${botId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
    });

    it("permanently deletes bot when confirmed with confirm: true", async () => {
      const resDel = await fetch(`${baseUrl}/api/v1/bots/${botId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${managementToken}`
        },
        body: JSON.stringify({ confirm: true })
      });

      assert.equal(resDel.status, 200);
      const jsonDel = await resDel.json();
      assert.equal(jsonDel.success, true);

      // Verify bot no longer exists
      const bot = await getBotById("", botId);
      assert.equal(bot, null);

      // Verify status endpoint now returns 404
      const resStatus = await fetch(`${baseUrl}/api/v1/bots/${botId}/status`, {
        headers: { Authorization: `Bearer ${managementToken}` }
      });
      assert.equal(resStatus.status, 404);
    });
  });
});
