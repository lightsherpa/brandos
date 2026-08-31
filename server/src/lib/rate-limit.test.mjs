import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIp,
  parseForwardedFor,
  clientIpFrom,
  createRateLimiter,
} from "./rate-limit.js";

test("normalizeIp strips ports, brackets, and the IPv4-mapped IPv6 prefix", () => {
  assert.equal(normalizeIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp(" 203.0.113.7:51234 "), "203.0.113.7");
  assert.equal(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
  assert.equal(normalizeIp("2001:DB8::1"), "2001:db8::1");
  assert.equal(normalizeIp(""), "");
  assert.equal(normalizeIp(null), "");
});

test("parseForwardedFor splits and normalizes the chain", () => {
  assert.deepEqual(parseForwardedFor("203.0.113.7, 70.41.3.18 , 150.172.238.178"), [
    "203.0.113.7",
    "70.41.3.18",
    "150.172.238.178",
  ]);
  assert.deepEqual(parseForwardedFor(" , ,"), []);
  assert.deepEqual(parseForwardedFor(undefined), []);
});

test("clientIpFrom ignores X-Forwarded-For entirely when the proxy is untrusted", () => {
  const ip = clientIpFrom({
    forwardedFor: "1.1.1.1",
    realIp: "2.2.2.2",
    remoteAddr: "10.0.0.5",
    trustProxy: false,
  });
  assert.equal(ip, "10.0.0.5");
});

test("clientIpFrom counts hops from the right so a spoofed prefix cannot escape the bucket", () => {
  // One trusted proxy in front: it appended the real socket peer last.
  const spoofed = clientIpFrom({
    forwardedFor: "9.9.9.9, 8.8.8.8, 203.0.113.7",
    remoteAddr: "10.0.0.5",
    trustProxy: true,
    hops: 1,
  });
  assert.equal(spoofed, "203.0.113.7", "attacker-supplied left-hand entries must be ignored");

  // Two trusted hops (CDN → platform): the client is two from the right.
  const twoHop = clientIpFrom({
    forwardedFor: "203.0.113.7, 172.16.0.1",
    remoteAddr: "10.0.0.5",
    trustProxy: true,
    hops: 2,
  });
  assert.equal(twoHop, "203.0.113.7");
});

test("clientIpFrom falls back to X-Real-IP then the socket peer when trusted", () => {
  assert.equal(
    clientIpFrom({ realIp: "203.0.113.9", remoteAddr: "10.0.0.5", trustProxy: true }),
    "203.0.113.9",
  );
  assert.equal(clientIpFrom({ remoteAddr: "10.0.0.5", trustProxy: true }), "10.0.0.5");
  assert.equal(clientIpFrom({ trustProxy: true }), "unknown");
});

test("createRateLimiter allows exactly `max` per window and then denies", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
  const t0 = 1_000_000;
  const results = [0, 1, 2, 3].map((i) => limiter.hit("ip:1.1.1.1", t0 + i));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
  assert.deepEqual(results.map((r) => r.remaining), [2, 1, 0, 0]);
  assert.equal(results[3].limit, 3);
  assert.ok(results[3].retryAfterSeconds >= 1);
});

test("createRateLimiter keys are independent and windows roll over", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 1 });
  const t0 = 2_000_000;
  assert.equal(limiter.hit("ip:a", t0).allowed, true);
  assert.equal(limiter.hit("ip:a", t0 + 10).allowed, false);
  assert.equal(limiter.hit("ip:b", t0 + 10).allowed, true, "a second key has its own budget");
  assert.equal(limiter.hit("ip:a", t0 + 1001).allowed, true, "window rolls over");
});

test("createRateLimiter bounds its key space so spoofed IPs cannot exhaust memory", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 50 });
  const t0 = 3_000_000;
  for (let i = 0; i < 500; i += 1) limiter.hit(`ip:198.51.100.${i}`, t0);
  assert.ok(limiter.size() <= 50, `expected <= 50 tracked keys, got ${limiter.size()}`);
});

test("createRateLimiter sweeps expired windows before evicting live ones", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 10, maxKeys: 3 });
  const t0 = 4_000_000;
  limiter.hit("ip:a", t0);
  limiter.hit("ip:b", t0);
  limiter.hit("ip:c", t0);
  assert.equal(limiter.size(), 3);
  // All three windows have expired by now, so a fourth key sweeps rather than evicts.
  limiter.hit("ip:d", t0 + 2000);
  assert.equal(limiter.size(), 1);
});
