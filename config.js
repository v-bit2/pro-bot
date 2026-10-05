export default {
  name: "Voltra Mini",
  owner: "263786624966",
  prefix: ".",
  port: Number(process.env.PORT || 3000),
  maxSessions: Number(process.env.MAX_SESSIONS || 10),
  sessionDir: "./sessions",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || ""
};
