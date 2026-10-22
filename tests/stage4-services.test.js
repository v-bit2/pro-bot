import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createApiV1Router } from "../routes/api-v1.js";
import { createBotRecord } from "../lib/bot-store.js";
import { SessionManager } from "../lib/session-manager.js";
import config from "../config.js";

process.env.ALLOW_MOCK_AUTH = "true";

describe("Stage 4: Digital Services API Gateway Integration & Security Tests", () => {
  let server = null;
  let baseUrl = "";
  const manager = new SessionManager(config);

  const userAlice = "mock-token-alice_serv_01";
  const userBob = "mock-token-bob_serv_02";
  let aliceBotId = null;
  let createdJobId = null;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1", createApiV1Router(manager));

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });

    // Create a bot for Alice
    const bot = await createBotRecord({
      ownerUid: "alice_serv_01",
      name: "Alice Digital Services Bot",
      phone: "263786624966"
    });
    aliceBotId = bot.botId;
  });

  after((done) => {
    if (server) server.close(done);
    else done();
  });

  async function apiRequest(path, { method = "GET", body = null, token = null } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const json = await res.json();
    return { status: res.status, json };
  }

  test("GET /api/v1/services Returns list of supported digital services", async () => {
    const { status, json } = await apiRequest("/services", { token: userAlice });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.services));
    const channelService = json.data.services.find(s => s.id === "channel-reaction");
    const pollService = json.data.services.find(s => s.id === "poll-dispatcher");
    assert.ok(channelService);
    assert.ok(pollService);
  });

  test("POST /api/v1/services/channel-reaction/jobs Validates and submits channel reaction job", async () => {
    const { status, json } = await apiRequest("/services/channel-reaction/jobs", {
      method: "POST",
      token: userAlice,
      body: {
        botId: aliceBotId,
        newsletterJid: "120363428077325156@newsletter",
        serverId: "105",
        emoji: "🔥"
      }
    });

    assert.equal(status, 202);
    assert.equal(json.success, true);
    assert.ok(json.data.jobId);
    assert.equal(json.data.service, "channel-reaction");
    assert.equal(json.data.status, "queued");
    createdJobId = json.data.jobId;
  });

  test("GET /api/v1/services/jobs/:jobId Retrieves job status for Alice", async () => {
    const { status, json } = await apiRequest(`/services/jobs/${createdJobId}`, {
      token: userAlice
    });

    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.equal(json.data.jobId, createdJobId);
    assert.equal(json.data.botId, aliceBotId);
  });

  test("GET /api/v1/services/jobs/:jobId Denies cross-user job access to Bob with 404", async () => {
    const { status, json } = await apiRequest(`/services/jobs/${createdJobId}`, {
      token: userBob
    });

    assert.equal(status, 404);
    assert.equal(json.success, false);
    assert.equal(json.error.code, "JOB_NOT_FOUND");
  });

  test("POST /api/v1/services/poll-dispatcher/jobs Validates poll payload requirements", async () => {
    const badRes = await apiRequest("/services/poll-dispatcher/jobs", {
      method: "POST",
      token: userAlice,
      body: {
        botId: aliceBotId,
        targetJid: "263786624966@s.whatsapp.net",
        question: "Invalid Poll"
      }
    });
    assert.equal(badRes.status, 202);

    const jobRes = await apiRequest(`/services/jobs/${badRes.json.data.jobId}`, {
      token: userAlice
    });
    assert.equal(jobRes.status, 200);
    assert.equal(jobRes.json.data.status, "failed");
    assert.equal(jobRes.json.data.error.code, "INVALID_OPTIONS");
  });

  test("POST /api/v1/services/unsupported-service/jobs Rejects unsupported service with 400", async () => {
    const { status, json } = await apiRequest("/services/unsupported-service/jobs", {
      method: "POST",
      token: userAlice,
      body: { botId: aliceBotId }
    });

    assert.equal(status, 400);
    assert.equal(json.success, false);
    assert.equal(json.error.code, "UNSUPPORTED_SERVICE");
  });
});
