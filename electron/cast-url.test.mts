import assert from "node:assert/strict";
import { test } from "node:test";
import { toCastUrl, type CastTarget } from "./cast-url.mts";

const target: CastTarget = {
  port: 8100,
  token: "loopback-token",
  castPort: 8200,
  castToken: "lan-token",
  deviceIp: "192.168.1.77",
};

const playback = "http://127.0.0.1:8100/video/proxy?h=abc&t=loopback-token";

test("swaps the host, the port and the token, keeping the rest", () => {
  const url = new URL(toCastUrl(playback, target) ?? "");
  assert.equal(url.port, "8200");
  assert.equal(url.pathname, "/video/proxy");
  assert.equal(url.searchParams.get("h"), "abc");
  assert.equal(url.searchParams.get("t"), "lan-token");
  assert.notEqual(url.hostname, "127.0.0.1", "a television cannot reach our loopback");
});

test("translates a downloaded file too", () => {
  const local = "http://localhost:8100/local?id=a&path=video.mp4&t=loopback-token";
  assert.match(toCastUrl(local, target) ?? "", /\/local\?id=a&path=video\.mp4&t=lan-token/);
});

test("refuses anything that did not come out of our own proxy", () => {
  assert.equal(toCastUrl("http://evil.test:8100/video/proxy?t=loopback-token", target), null);
  assert.equal(toCastUrl("http://127.0.0.1:9999/video/proxy?t=loopback-token", target), null);
  assert.equal(toCastUrl("http://127.0.0.1:8100/admin?t=loopback-token", target), null);
  assert.equal(toCastUrl("not a url", target), null);
});

test("refuses a caller that does not already hold the loopback token", () => {
  assert.equal(toCastUrl("http://127.0.0.1:8100/video/proxy?h=abc", target), null);
  assert.equal(toCastUrl("http://127.0.0.1:8100/video/proxy?h=abc&t=guess", target), null);
});
