import assert from "node:assert/strict";
import { test } from "node:test";
import { languageLabel, pickLanguage } from "./languages.ts";

test("a language is labelled the way the catalogue writes it", () => {
  assert.equal(languageLabel("vostfr"), "VOSTFR");
  assert.equal(languageLabel("VF"), "VF");
});

test("a numbered dub keeps its number", () => {
  assert.equal(languageLabel("vf2"), "VF 2");
  assert.equal(languageLabel("va1"), "VA 1");
});

test("an unknown language is shown rather than hidden", () => {
  assert.equal(languageLabel("vpt"), "VPT");
});

test("the language asked for wins when the season has it", () => {
  assert.equal(pickLanguage(["vostfr", "vf"], "vf"), "vf");
});

test("a numbered variant is the same dub, and beats the first on the list", () => {
  assert.equal(pickLanguage(["vostfr", "vf1", "vf2"], "vf"), "vf1");
});

test("with nothing close, the first available language is taken", () => {
  assert.equal(pickLanguage(["vostfr"], "vf"), "vostfr");
  assert.equal(pickLanguage([], "vf"), "vf");
});
