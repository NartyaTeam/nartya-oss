import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { normalize, readApiBase } from "./api-base.mts";

const dirWith = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-base-"));
  writeFileSync(join(dir, "build-config.json"), contents);
  return dir;
};

test("a trailing slash is not part of the address", () => {
  assert.equal(normalize("https://api.example.test/"), "https://api.example.test");
  assert.equal(normalize("https://api.example.test///"), "https://api.example.test");
});

test("plain http is refused, except on loopback where there is no network to listen on", () => {
  assert.equal(normalize("http://api.example.test"), null);
  assert.equal(normalize("http://localhost:3000"), "http://localhost:3000");
  assert.equal(normalize("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
});

test("what is not an address is no address", () => {
  assert.equal(normalize("anime.example.test"), null);
  assert.equal(normalize("   "), null);
  assert.equal(normalize(undefined), null);
});

test("the environment wins over what the build baked in", () => {
  const dir = dirWith(JSON.stringify({ apiBase: "https://baked.example.test" }));
  const env = { NARTYA_API_BASE: "https://live.example.test" };
  assert.equal(readApiBase(dir, env), "https://live.example.test");
});

test("a packaged build reads what it was given, having no environment of its own", () => {
  const dir = dirWith(JSON.stringify({ apiBase: "https://baked.example.test/" }));
  assert.equal(readApiBase(dir, {}), "https://baked.example.test");
});

test("no environment and no file is no api, which is the demo", () => {
  assert.equal(readApiBase(dirWith("not json"), {}), null);
  assert.equal(readApiBase(join(tmpdir(), "nartya-missing"), {}), null);
});
