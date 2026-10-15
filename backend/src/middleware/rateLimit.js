// Small in-memory fixed-window rate limiter for the auth endpoints
// (brute-force protection on login, spam protection on register).
// In-memory means per process: fine for a single API instance; a
// multi-instance deployment would move the counters to a shared store
// such as Redis.
function createRateLimiter({ windowMs, max, keyFn, message }) {
  const hits = new Map();

  // Drop expired windows so the map can't grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return function rateLimit(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }

    next();
  };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";
const passThrough = (req, res, next) => next();

// The integration test suite sends every request from 127.0.0.1, so the
// auth limits are off under NODE_ENV=test; the limiter itself has its
// own unit test.
const enabled = process.env.NODE_ENV !== "test";

const loginRateLimit = enabled
  ? createRateLimiter({
      windowMs: FIFTEEN_MINUTES,
      max: 10,
      keyFn: (req) => `${clientIp(req)}|${String(req.body?.email || "").trim().toLowerCase()}`,
      message: "Çok fazla giriş denemesi. Lütfen birkaç dakika sonra tekrar deneyin.",
    })
  : passThrough;

const registerRateLimit = enabled
  ? createRateLimiter({
      windowMs: FIFTEEN_MINUTES,
      max: 20,
      keyFn: clientIp,
      message: "Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.",
    })
  : passThrough;

module.exports = { createRateLimiter, loginRateLimit, registerRateLimit };
