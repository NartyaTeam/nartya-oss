import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import type { Fetch } from "./download-file.mts";
import { downloadScanChapter, isTrustedBase, pageFile, pageUrl } from "./download-scans.mts";

const base = {
  imageBase: "https://api.test/anime/scans/image",
  oeuvre: "one piece",
  folder: "ch-1",
};

function counting(): { fetch: Fetch; asked: string[] } {
  const asked: string[] = [];
  const fetch = ((url: string) => {
    asked.push(url);
    return Promise.resolve({
      url,
      status: 200,
      statusText: "OK",
      headers: { "content-length": "5" },
      stream: Readable.from([Buffer.from("bytes")]),
    });
  }) as unknown as Fetch;
  return { fetch, asked };
}

test("escapes the work name in a page url", () => {
  assert.equal(pageUrl(base, 3), "https://api.test/anime/scans/image/one%20piece/ch-1/3.jpg");
  assert.equal(pageFile(3), "p003.jpg");
  assert.equal(pageFile(42), "p042.jpg");
});

test("trusts the api origin and, in development only, loopback", () => {
  assert.equal(isTrustedBase("https://api.test/x", "https://api.test", false), true);
  assert.equal(isTrustedBase("https://evil.test/x", "https://api.test", false), false);
  assert.equal(isTrustedBase("http://localhost:3000/x", "https://api.test", true), true);
  assert.equal(isTrustedBase("http://localhost:3000/x", "https://api.test", false), false);
  assert.equal(isTrustedBase("not a url", "https://api.test", true), false);
});

test("downloads every page of the chapter", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-scan-"));
  const { fetch, asked } = counting();
  const bytes = await downloadScanChapter(fetch, {
    ...base,
    pages: 3,
    dir,
    signal: new AbortController().signal,
    onProgress: () => {},
  });

  assert.equal(asked.length, 3);
  assert.equal(bytes, 15);
  assert.equal(readFileSync(join(dir, "p001.jpg"), "utf8"), "bytes");
});

test("resumes a chapter instead of downloading it again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "nartya-scan-"));
  writeFileSync(join(dir, "p001.jpg"), "bytes");
  const { fetch, asked } = counting();

  await downloadScanChapter(fetch, {
    ...base,
    pages: 2,
    dir,
    signal: new AbortController().signal,
    onProgress: () => {},
  });
  assert.deepEqual(
    asked.map((url) => url.endsWith("2.jpg")),
    [true],
    "only the missing page",
  );
});

test("refuses a chapter that claims no page", async () => {
  await assert.rejects(
    downloadScanChapter(counting().fetch, {
      ...base,
      pages: 0,
      dir: mkdtempSync(join(tmpdir(), "nartya-scan-")),
      signal: new AbortController().signal,
      onProgress: () => {},
    }),
    /sans page/,
  );
});
