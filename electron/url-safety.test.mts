import assert from "node:assert/strict";
import { test } from "node:test";
import { isPathInside, isPrivateAddress, validateExternalUrl } from "./url-safety.mts";

const never: () => Promise<string[]> = () => Promise.reject(new Error("should not resolve"));

test("recognises the private and reserved ranges", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "::1",
    "fe80::1",
  ]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2001:4860:4860::8888"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});

test("sees through an ipv4 address written as ipv6", () => {
  for (const address of [
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::FFFF:10.0.0.5",
    "::ffff:c0a8:101",
  ]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("::ffff:8.8.8.8"), false);
});

test("refuses the addresses no host lives on", () => {
  for (const address of ["::", "224.0.0.251", "239.255.255.250", "255.255.255.255", "240.0.0.1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
});

test("refuses an ipv6 literal pointing home, brackets and all", async () => {
  const check = await validateExternalUrl("http://[::ffff:127.0.0.1]:8080/", async () => []);
  assert.equal(check.valid, false);
  const loopback = await validateExternalUrl("http://[::1]/", async () => ["93.184.216.34"]);
  assert.equal(loopback.valid, false);
});

test("treats an empty address as private", () => {
  assert.equal(isPrivateAddress(""), true);
});

test("refuses anything that is not http", async () => {
  const result = await validateExternalUrl("file:///etc/passwd", never);
  assert.deepEqual(result, { valid: false, error: "Protocole non autorisé" });
});

test("refuses a literal private address without resolving", async () => {
  const result = await validateExternalUrl("http://192.168.1.10/stream", never);
  assert.equal(result.valid, false);
});

test("refuses a hostname that resolves into the local network", async () => {
  const result = await validateExternalUrl("https://sinkhole.test/x", async () => ["10.0.0.5"]);
  assert.equal(result.valid, false);
});

test("accepts a hostname that resolves to a public address", async () => {
  const result = await validateExternalUrl("https://cdn.test/x", async () => ["93.184.216.34"]);
  assert.deepEqual(result, { valid: true });
});

test("refuses when the name does not resolve at all", async () => {
  assert.equal((await validateExternalUrl("https://nope.test", async () => [])).valid, false);
  assert.equal((await validateExternalUrl("https://nope.test", never)).valid, false);
});

test("keeps a path inside its base directory", () => {
  assert.equal(isPathInside("/downloads/a/b.mp4", "/downloads"), true);
  assert.equal(isPathInside("/downloads", "/downloads"), true);
  assert.equal(isPathInside("/downloads2/b.mp4", "/downloads"), false);
  assert.equal(isPathInside("/downloads/../etc/passwd", "/downloads"), false);
});
