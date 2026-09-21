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
