import assert from "node:assert/strict";
import { test } from "node:test";
import { dedupeBySlug } from "./rows.ts";

const at = (slug: string, title: string) => ({ slug, title });

test("two seasons sharing a streaming slug make one card", () => {
  const items = [at("link-click", "Link Click"), at("link-click", "Link Click II")];
  assert.deepEqual(dedupeBySlug(items), [at("link-click", "Link Click")]);
});

test("the first of a pair is the one kept, and the order holds", () => {
  const items = [at("a", "A"), at("b", "B"), at("a", "A bis"), at("c", "C")];
  assert.deepEqual(
    dedupeBySlug(items).map((item) => item.slug),
    ["a", "b", "c"],
  );
});
