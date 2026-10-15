// Unit test for the auth rate limiter (the integration suite runs with
// the auth limits disabled, since all its requests share one IP).
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimiter } = require("../../src/middleware/rateLimit");

function run(limiter, key) {
  let status = 200;
  let passed = false;
  const res = {
    set() {},
    status(code) { status = code; return this; },
    json() { return this; },
  };
  limiter({ key }, res, () => { passed = true; });
  return passed ? 200 : status;
}

describe("auth rate limiter", () => {
  it("allows `max` requests per key, then answers 429", () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3, keyFn: (req) => req.key, message: "slow down" });
    assert.deepEqual([1, 2, 3, 4, 5].map(() => run(limiter, "a")), [200, 200, 200, 429, 429]);
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1, keyFn: (req) => req.key, message: "slow down" });
    assert.equal(run(limiter, "a"), 200);
    assert.equal(run(limiter, "b"), 200);
    assert.equal(run(limiter, "a"), 429);
  });

  it("resets after the window", async () => {
    const limiter = createRateLimiter({ windowMs: 50, max: 1, keyFn: (req) => req.key, message: "slow down" });
    assert.equal(run(limiter, "a"), 200);
    assert.equal(run(limiter, "a"), 429);
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(run(limiter, "a"), 200);
  });
});
