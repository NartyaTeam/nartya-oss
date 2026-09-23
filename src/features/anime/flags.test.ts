import assert from "node:assert/strict";
import { test } from "node:test";
import { flagFor } from "./flags.ts";

test("a dub shows the country of its audio, whatever the work's origin", () => {
  assert.equal(flagFor("vf", "JP"), "FR");
  assert.equal(flagFor("vf2", "CN"), "FR");
  assert.equal(flagFor("vqc", "JP"), "FR");
  assert.equal(flagFor("va", "JP"), "EN");
  assert.equal(flagFor("vkr", "JP"), "KR");
});

test("an original version shows where the work comes from", () => {
  assert.equal(flagFor("vostfr", "JP"), "JP");
  assert.equal(flagFor("vostfr", "CN"), "CN");
  assert.equal(flagFor("vostfr", "KR"), "KR");
});

test("an origin the flags do not cover, or none at all, falls back to Japan", () => {
  assert.equal(flagFor("vostfr", "US"), "JP");
  assert.equal(flagFor("vostfr", null), "JP");
});
