import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect, normalizePath } from "./check-style.ts";

test("accepts a short comment", () => {
  const source = [
    "// Safari reports a duration of 0 until metadata has loaded.",
    "const a = 1;",
  ].join("\n");
  assert.deepEqual(inspect("a.ts", source), []);
});

test("rejects a comment block longer than two lines", () => {
  const source = ["// one", "// two", "// three", "const a = 1;"].join("\n");
  const rules = inspect("a.ts", source).map((finding) => finding.rule);
  assert.deepEqual(rules, ["comment-block"]);
});

test("rejects emoji and box drawing", () => {
  const rules = inspect("a.ts", "const a = 1; // ok ✅").map((finding) => finding.rule);
  assert.deepEqual(rules, ["emoji"]);
});

test("rejects a hardcoded url", () => {
  const findings = inspect("a.ts", 'const base = "https://example.com/api";');
  assert.equal(findings[0]?.rule, "hardcoded-url");
});

test("reports the line where the block starts", () => {
  const source = ["const a = 1;", "/*", " * one", " * two", " */"].join("\n");
  assert.equal(inspect("a.ts", source)[0]?.line, 2);
});

test("normalizes windows separators so the ignore list matches", () => {
  assert.equal(normalizePath("scripts\\check-style.test.ts"), "scripts/check-style.test.ts");
  assert.equal(normalizePath("scripts/check-style.test.ts"), "scripts/check-style.test.ts");
});

test("allows urls in test fixtures but not in source files", () => {
  const source = 'const base = "https://example.com";';
  assert.equal(inspect("src/lib/thing.test.ts", source).length, 0);
  assert.equal(inspect("electron/thing.test.mts", source).length, 0);
  assert.equal(inspect("src/lib/thing.ts", source)[0]?.rule, "hardcoded-url");
});

test("allows urls in an endpoints file but not beside it", () => {
  const source = 'export const A = ["https://1.1.1.1/dns-query"];';
  assert.equal(inspect("electron/endpoints.mts", source).length, 0);
  assert.equal(inspect("electron/doh.mts", source)[0]?.rule, "hardcoded-url");
});

test("ignores templated hosts and loopback", () => {
  assert.equal(inspect("a.ts", "const u = `http://${HOST}:${port}/x`;").length, 0);
  assert.equal(inspect("a.ts", 'const u = "http://127.0.0.1:8351/auth-callback";').length, 0);
  assert.equal(inspect("a.ts", 'const u = "http://localhost:5173/";').length, 0);
  assert.equal(inspect("a.ts", 'const u = "https://api.example.com";')[0]?.rule, "hardcoded-url");
});
