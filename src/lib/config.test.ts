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

test("the Discord application id is a number, or nothing", () => {
  const read = (id: string) => {
    const result = parseConfig({ ...complete, VITE_DISCORD_RPC_CLIENT_ID: id });
    return result.ok ? result.config.discordClientId : undefined;
  };
  assert.equal(read(" 1234567890 "), "1234567890");
  assert.equal(read("not-an-id"), null);
  assert.equal(read(""), null);
});

test("the site url is https only, without its trailing slash", () => {
  const read = (url: string) => {
    const result = parseConfig({ ...complete, VITE_SITE_URL: url });
    return result.ok ? result.config.siteUrl : undefined;
  };
  assert.equal(read("https://site.test/"), "https://site.test");
  assert.equal(read("http://site.test"), null);
  assert.equal(read(""), null);
});
