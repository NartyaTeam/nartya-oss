import assert from "node:assert/strict";
import { test } from "node:test";
import { broadcasterName, isFreeToWatch } from "./broadcasters.ts";

test("a known broadcaster is named the way it names itself", () => {
  assert.equal(broadcasterName("animationdigitalnetwork.fr"), "ADN");
  assert.equal(broadcasterName("disneyplus.com"), "Disney+");
});

test("an unknown host is named after its first label rather than dropped", () => {
  assert.equal(broadcasterName("wakanim.tv"), "Wakanim");
  assert.equal(broadcasterName(""), "le diffuseur");
});

test("free to watch is only claimed for the broadcasters that are", () => {
  assert.equal(isFreeToWatch("arte.tv"), true);
  assert.equal(isFreeToWatch("netflix.com"), false);
  assert.equal(isFreeToWatch("wakanim.tv"), false);
});
