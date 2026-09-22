import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { normalize, readApiBase } from "./api-base.mts";

const dirWith = (contents: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-base-"));
  writeFileSync(join(dir, "build-config.json"), contents);
  return dir;
};

const checkoutWith = (dotEnv: string, buildConfig?: string): string => {
  const root = mkdtempSync(join(tmpdir(), "nartya-checkout-"));
  const dir = join(root, "dist-electron", "electron");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, ".env"), dotEnv);
  if (buildConfig !== undefined) writeFileSync(join(dir, "build-config.json"), buildConfig);
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

test("a source checkout falls back on the address the front end was given", () => {
  const dir = checkoutWith("VITE_SUPABASE_URL=x\nVITE_API_BASE=https://checkout.example.test/\n");
  assert.equal(readApiBase(dir, {}), "https://checkout.example.test");
});

test("a quoted or commented out address is read as written, or not at all", () => {
  assert.equal(
    readApiBase(checkoutWith('VITE_API_BASE="https://quoted.example.test"'), {}),
    "https://quoted.example.test",
  );
  assert.equal(readApiBase(checkoutWith("# VITE_API_BASE=https://off.example.test"), {}), null);
  assert.equal(readApiBase(checkoutWith("VITE_API_BASE="), {}), null);
});

test("what the build baked in wins over the checkout's .env", () => {
  const dir = checkoutWith(
    "VITE_API_BASE=https://checkout.example.test",
    JSON.stringify({ apiBase: "https://baked.example.test" }),
  );
  assert.equal(readApiBase(dir, {}), "https://baked.example.test");
});
