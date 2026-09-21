import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandles } from "./stream-handles.mts";

test("gives the same handle back for the same target", () => {
  const handles = createHandles();
  const first = handles.mint({ url: "https://cdn.test/a.ts", provider: "s1" });
  const again = handles.mint({ url: "https://cdn.test/a.ts", provider: "s1" });
  assert.equal(first, again);
  assert.equal(handles.size, 1);
});

test("separates targets that differ only by their headers", () => {
  const handles = createHandles();
  const plain = handles.mint({ url: "https://cdn.test/a.ts" });
  const refered = handles.mint({ url: "https://cdn.test/a.ts", referer: "https://one.test/" });
  assert.notEqual(plain, refered);
});

test("resolves a handle to its target and nothing else", () => {
  const handles = createHandles();
  const handle = handles.mint({ url: "https://cdn.test/a.ts", referer: "https://one.test/" });
  assert.deepEqual(handles.resolve(handle), {
    url: "https://cdn.test/a.ts",
    provider: null,
    referer: "https://one.test/",
    origin: "",
  });
  assert.equal(handles.resolve("unknown"), null);
  assert.equal(handles.resolve(null), null);
});

test("refuses to mint without a url", () => {
  assert.equal(createHandles().mint({}), null);
});

test("evicts the oldest handles past the ceiling", () => {
  const handles = createHandles(2);
  const first = handles.mint({ url: "https://cdn.test/1.ts" });
  handles.mint({ url: "https://cdn.test/2.ts" });
  handles.mint({ url: "https://cdn.test/3.ts" });

  assert.equal(handles.size, 2);
  assert.equal(handles.resolve(first), null);
  // The content index must go with it, or a re-mint would hand back a dead handle.
  assert.notEqual(handles.mint({ url: "https://cdn.test/1.ts" }), first);
});

test("forgets everything when the session ends", () => {
  const handles = createHandles();
  const handle = handles.mint({ url: "https://cdn.test/a.ts" });
  handles.clear();
  assert.equal(handles.resolve(handle), null);
});
