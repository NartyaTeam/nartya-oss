import assert from "node:assert/strict";
import { test } from "node:test";
import { captchaPage, isSiteKey } from "./captcha.mts";

test("accepts a site key, and only what a site key looks like", () => {
  assert.equal(isSiteKey("0x4AAAAAAEFfyKPirwZPGekW"), true);
  assert.equal(isSiteKey("short"), false);
  assert.equal(isSiteKey(""), false);
  assert.equal(isSiteKey(null), false);
  assert.equal(isSiteKey(42), false);
  assert.equal(isSiteKey('0x4AAA");alert(1);//'), false, "nothing that could close the string");
});

test("builds a page that renders the widget and posts the token back", () => {
  const page = captchaPage("0x4AAAAAAEFfyKPirwZPGekW", "/captcha-token");

  assert.match(page, /challenges\.cloudflare\.com/);
  assert.match(page, /sitekey: "0x4AAAAAAEFfyKPirwZPGekW"/);
  assert.match(page, /"\/captcha-token" \+ "\?token=" \+ encodeURIComponent\(token\)/);
  assert.match(page, /lang="fr"/);
});
