import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "./check-style.ts";

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
