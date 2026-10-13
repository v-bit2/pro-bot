import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verifyFirebaseToken } from "../lib/firebase-admin.js";
import {
  createBotRecord,
  getBotsByOwner,
  verifyBotOwnership
} from "../lib/bot-store.js";
import { SessionManager } from "../lib/session-manager.js";
import config from "../config.js";

// Enable mock auth for testing environment
process.env.ALLOW_MOCK_AUTH = "true";
process.env.MAX_BOTS_PER_USER = "2";

describe("Stage 2: Firebase Auth & Multi-Tenant Bot Store Integration Tests", () => {

  describe("1. Firebase Token Verification Middleware", () => {
    test("Rejects request missing Authorization header with 401", async () => {
      let statusCode = 0;
      let jsonResult = null;

      const req = { headers: {} };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await verifyFirebaseToken(req, res, () => {
        assert.fail("next() should not be called when Authorization header is missing");
      });

      assert.equal(statusCode, 401);
      assert.equal(jsonResult.ok, false);
      assert.match(jsonResult.error, /Missing or malformed Authorization header/i);
    });

    test("Rejects request with empty or non-Bearer token with 401", async () => {
      let statusCode = 0;
      let jsonResult = null;

      const req = { headers: { authorization: "Basic invalid-credentials" } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonResult = data;
          return this;
        }
      };

      await verifyFirebaseToken(req, res, () => {
        assert.fail("next() should not be called for non-Bearer auth");
      });

      assert.equal(statusCode, 401);
      assert.equal(jsonResult.ok, false);
    });

    test("Extracts verified Firebase UID from valid mock token", async () => {
      let nextCalled = false;
      const req = { headers: { authorization: "Bearer mock-token-user123" } };
      const res = {};

      await verifyFirebaseToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user.uid, "user123");
      assert.equal(req.user.email, "user123@example.com");
    });
  });

  describe("2. Multi-Tenant Bot Store & Ownership Security Checks", () => {
    const userA = "firebase_uid_alice_111";
    const userB = "firebase_uid_bob_222";
    let botIdAlice1 = null;

    test("Creates bot record assigned to specific owner UID", async () => {
      const bot = await createBotRecord({
        ownerUid: userA,
        name: "Alice's WhatsApp Assistant",
        phone: "263786624966"
      });

      assert.ok(bot.botId);
      assert.equal(bot.ownerUid, userA);
      assert.equal(bot.name, "Alice's WhatsApp Assistant");
      assert.equal(bot.status, "idle");
      botIdAlice1 = bot.botId;
    });

    test("Retrieves bots by owner UID", async () => {
      const aliceBots = await getBotsByOwner(userA);
      assert.equal(aliceBots.length, 1);
      assert.equal(aliceBots[0].botId, botIdAlice1);

      const bobBots = await getBotsByOwner(userB);
      assert.equal(bobBots.length, 0);
    });

    test("Verifies bot ownership for legitimate owner", async () => {
      const bot = await verifyBotOwnership(botIdAlice1, userA);
      assert.equal(bot.botId, botIdAlice1);
      assert.equal(bot.ownerUid, userA);
    });

    test("Denies cross-user access with 403 Forbidden", async () => {
      await assert.rejects(
        async () => {
          await verifyBotOwnership(botIdAlice1, userB);
        },
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /Forbidden/i);
          return true;
        }
      );
    });

    test("Enforces MAX_BOTS_PER_USER quota limit", async () => {
      // Alice already has 1 bot, MAX_BOTS_PER_USER = 2
      const bot2 = await createBotRecord({ ownerUid: userA, name: "Alice Second Bot" });
      assert.ok(bot2.botId);

      // 3rd bot creation should fail with 429
      await assert.rejects(
        async () => {
          await createBotRecord({ ownerUid: userA, name: "Alice Exceeded Quota Bot" });
        },
        (err) => {
          assert.equal(err.statusCode, 429);
          assert.match(err.message, /Bot limit reached/i);
          return true;
        }
      );
    });
  });

  describe("3. Existing Bot Engine & Session Compatibility", () => {
    test("Instantiates SessionManager without breaking change", () => {
      const manager = new SessionManager(config);
      assert.equal(typeof manager.count, "function");
      assert.equal(typeof manager.createOrPair, "function");
      assert.equal(typeof manager.disconnect, "function");
      assert.equal(manager.count(), 0);
    });
  });

});
