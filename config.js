export default {
  name: "Voltra Mini",
  botName: process.env.BOT_NAME || "Voltra MD",
  newsletterName: process.env.NEWSLETTER_NAME || "VOLTRA MD",
  newsletterJid: process.env.NEWSLETTER_JID || "120363428077325156@newsletter",
  owner: process.env.OWNER_NUMBER || "263786624966",
  prefix: process.env.PREFIX || ".",
  mode: process.env.BOT_MODE || "public",
  antiCall: process.env.ANTI_CALL || "off",
  msgReaction: process.env.MSG_REACTION || "off",
  autoStatus: process.env.AUTO_STATUS === "true",
  autoRead: process.env.AUTO_READ === "true",
  autoTyping: process.env.AUTO_TYPING === "true",
  autoReact: process.env.AUTO_REACT === "true",
  port: Number(process.env.PORT || 3000),
  maxSessions: Number(process.env.MAX_SESSIONS || 1000),
  sessionDir: process.env.SESSION_DIR || "./sessions",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",

  // MongoDB Session Store URI
  mongoUri: process.env.MONGO_URI || "mongodb+srv://calyxdrey11:voltrabotpassword@drey.qptc9q8.mongodb.net/?appName=Drey",

  // Keep-alive settings
  keepAlive: process.env.KEEP_ALIVE === "true",
  keepAliveUrl: process.env.KEEP_ALIVE_URL || "",
  keepAliveInterval: Number(process.env.KEEP_ALIVE_INTERVAL || 300000), // 5 minutes default

  // Typing & presence simulation settings
  typingDelayMin: Number(process.env.TYPING_DELAY_MIN || 300),
  typingDelayMax: Number(process.env.TYPING_DELAY_MAX || 2500),
  typingMsPerChar: Number(process.env.TYPING_MS_PER_CHAR || 15),

  // Automatic WhatsApp Channel Following
  channelAutoFollow: {
    enabled: true,
    sourceUrl: "https://channel-newsletters.netlify.app/channels.json",
    refreshIntervalMs: Number(process.env.CHANNEL_REFRESH_INTERVAL || 900000), // 15 mins
    maxAttempts: 3,
    requestTimeoutMs: 10000,
    delayBetweenChannelsMs: 1500
  },

  // Automatic WhatsApp Channel Post Reactions
  channelAutoReact: {
    enabled: true,
    emojis: ["❤️", "🔥", "⚡", "😍", "💯"],
    delayBetweenReactionsMs: 2000,
    maxRetries: 2
  }
};
