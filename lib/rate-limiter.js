/**
 * Lightweight in-memory rate limiter middleware per client IP address.
 */
export function createRateLimiter({ windowMs = 60000, max = 30, message = "Too many requests, please try again later." } = {}) {
  const requests = new Map();

  // Periodically clean up stale IP entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter(ts => ts > now - windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, 300000).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const now = Date.now();
    const windowStart = now - windowMs;

    let userTimestamps = requests.get(ip) || [];
    userTimestamps = userTimestamps.filter(ts => ts > windowStart);

    if (userTimestamps.length >= max) {
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message
        }
      });
    }

    userTimestamps.push(now);
    requests.set(ip, userTimestamps);
    next();
  };
}
