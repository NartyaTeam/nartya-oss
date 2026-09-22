import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { countLeaksIn, countPasswordLeaks, type Fetch } from "./password-safety.ts";

const hashOf = (password: string) =>
  createHash("sha1").update(password).digest("hex").toUpperCase();

function answering(body: string, ok = true): { fetcher: Fetch; asked: string[] } {
  const asked: string[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    asked.push(String(url));
    assert.equal((init?.headers as Record<string, string>)["Add-Padding"], "true");
    return { ok, text: async () => body } as Response;
  }) as Fetch;
  return { fetcher, asked };
}

test("reads the count of the matching suffix, padding aside", () => {
  const body = "AAAA1:12345\r\nBBBB2:0\r\nCCCC3:7";
  assert.equal(countLeaksIn(body, "CCCC3"), 7);
  assert.equal(countLeaksIn(body, "BBBB2"), 0, "a padding entry is not a leak");
  assert.equal(countLeaksIn(body, "DDDD4"), 0);
  assert.equal(countLeaksIn("", "CCCC3"), 0);
});

test("sends five characters of the hash and nothing else", async () => {
  const hash = hashOf("hunter2");
  const { fetcher, asked } = answering(`${hash.slice(5)}:4200`);

  assert.equal(await countPasswordLeaks("hunter2", fetcher), 4200);
  assert.deepEqual(asked, [`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`]);
  assert.equal(asked[0]?.includes("hunter2"), false, "the password never leaves the machine");
  assert.equal(asked[0]?.includes(hash.slice(5)), false, "nor does the rest of its hash");
});

test("a password nobody leaked comes back at zero", async () => {
  const { fetcher } = answering("0000000000000000000000000000000000000:9");
  assert.equal(await countPasswordLeaks("a-long-unlikely-passphrase", fetcher), 0);
});

test("an unreachable service is unknown, not safe and not unsafe", async () => {
  const { fetcher } = answering("", false);
  assert.equal(await countPasswordLeaks("hunter2", fetcher), null);

  const throwing = (() => Promise.reject(new Error("offline"))) as Fetch;
  assert.equal(await countPasswordLeaks("hunter2", throwing), null);
});
