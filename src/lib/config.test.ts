import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConfig } from "./config.ts";

const complete = { VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "key" };

test("reads a complete environment", () => {
  const result = parseConfig(complete);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.config.supabaseUrl, "https://x.supabase.co");
  assert.equal(result.ok && result.config.apiBase, null);
});

test("lists every missing variable at once", () => {
  const result = parseConfig({});
  assert.equal(result.ok, false);
  assert.deepEqual(result.ok === false && result.missing, [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
  ]);
});

test("treats blank values as missing", () => {
  const result = parseConfig({ ...complete, VITE_SUPABASE_URL: "   " });
  assert.deepEqual(result.ok === false && result.missing, ["VITE_SUPABASE_URL"]);
});

test("drops trailing slashes from the api base", () => {
  const result = parseConfig({ ...complete, VITE_API_BASE: "https://api.example.com//" });
  assert.equal(result.ok && result.config.apiBase, "https://api.example.com");
});

test("the captcha key is optional, and blank is the same as absent", () => {
  const without = parseConfig(complete);
  assert.equal(without.ok && without.config.captchaSiteKey, null);

  const blank = parseConfig({ ...complete, VITE_TURNSTILE_SITE_KEY: "   " });
  assert.equal(blank.ok && blank.config.captchaSiteKey, null);

  const given = parseConfig({ ...complete, VITE_TURNSTILE_SITE_KEY: " 0x4AAAAAAEFfy " });
  assert.equal(given.ok && given.config.captchaSiteKey, "0x4AAAAAAEFfy");
});
