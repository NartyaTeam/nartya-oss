import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import zlib from "node:zlib";
import { blocked, followChecked, type Attempt } from "./provider-fetch.mts";

const allow = async () => ({ valid: true }) as const;
const agent = new http.Agent({ keepAlive: false });

async function serve(
  handler: http.RequestListener,
): Promise<{ origin: string; close: () => void }> {
  const server = http.createServer(handler);
  // Its own port per test: a pooled socket from another one would blur the result.
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

function attempt(headers: Record<string, string> = {}, timeoutMs = 2_000): Attempt {
  return { headers, timeoutMs, agent: () => agent };
}

async function body(stream: NodeJS.ReadableStream): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += String(chunk);
  return text;
}

test("returns the response and the headers it was sent", async () => {
  const seen: http.IncomingHttpHeaders[] = [];
  const server = await serve((request, response) => {
    seen.push(request.headers);
    response.writeHead(206, { "content-range": "bytes 0-9/100" });
    response.end("0123456789");
  });

  const result = await followChecked(
    `${server.origin}/a.mp4`,
    attempt({ Referer: "https://one.test/", Range: "bytes=0-9" }),
    allow,
  );
  assert.equal(result.status, 206);
  assert.equal(result.headers["content-range"], "bytes 0-9/100");
  assert.equal(await body(result.stream), "0123456789");
  assert.equal(seen[0]?.referer, "https://one.test/");
  assert.equal(seen[0]?.range, "bytes=0-9");
  server.close();
});

test("follows redirects and validates every hop", async () => {
  const server = await serve((request, response) => {
    if (request.url === "/first") {
      response.writeHead(302, { location: "/second" });
      response.end();
      return;
    }
    response.writeHead(200);
    response.end("landed");
  });

  const checked: string[] = [];
  const result = await followChecked(`${server.origin}/first`, attempt(), async (url) => {
    checked.push(new URL(url).pathname);
    return { valid: true };
  });
  assert.equal(await body(result.stream), "landed");
  assert.deepEqual(checked, ["/first", "/second"]);
  assert.equal(result.url, `${server.origin}/second`);
  server.close();
});

test("refuses a hop the validator rejects", async () => {
  const server = await serve((_request, response) => {
    response.writeHead(302, { location: "http://127.0.0.1:1/internal" });
    response.end();
  });

  await assert.rejects(
    followChecked(`${server.origin}/first`, attempt(), async (url) =>
      url.endsWith("/internal")
        ? { valid: false, error: "IP privée ou réservée" }
        : { valid: true },
    ),
    { code: "URL_BLOCKED" },
  );
  server.close();
});

test("stops after too many redirects", async () => {
  const server = await serve((_request, response) => {
    response.writeHead(302, { location: "/loop" });
    response.end();
  });

  await assert.rejects(followChecked(`${server.origin}/loop`, attempt(), allow), {
    message: "Trop de redirections",
  });
  server.close();
});

test("gives up when the host accepts the connection and never answers", async () => {
  const server = await serve(() => {});

  await assert.rejects(followChecked(`${server.origin}/a.mp4`, attempt({}, 150), allow), {
    message: /Timeout \(150ms\)/,
  });
  server.close();
});

test("lets the caller abort", async () => {
  const server = await serve(() => {});
  const controller = new AbortController();
  const pending = followChecked(
    `${server.origin}/a.mp4`,
    { ...attempt(), signal: controller.signal },
    allow,
  );
  controller.abort();

  await assert.rejects(pending, { name: "AbortError" });
  server.close();
});

test("names a blocked url without leaking what it was", () => {
  const error = blocked("IP privée ou réservée");
  assert.equal(error.message, "URL bloquée : IP privée ou réservée");
  assert.equal((error as NodeJS.ErrnoException).code, "URL_BLOCKED");
});

const PAGE =
  "<script>jwplayer().setup({ sources: [{ file: 'https://cdn.test/master.m3u8' }] })</script>";

for (const [encoding, compress] of [
  ["gzip", zlib.gzipSync],
  ["deflate", zlib.deflateSync],
  ["br", zlib.brotliCompressSync],
] as const) {
  test(`a ${encoding} body is read as the page it is, not as its compressed bytes`, async () => {
    const packed = compress(Buffer.from(PAGE));
    const server = await serve((_request, response) => {
      response.writeHead(200, {
        "content-type": "text/html",
        "content-encoding": encoding,
        "content-length": String(packed.length),
      });
      response.end(packed);
    });

    try {
      const result = await followChecked(`${server.origin}/embed`, attempt(), allow);
      assert.equal(await body(result.stream), PAGE);
      assert.equal(result.headers["content-encoding"], undefined);
      assert.equal(result.headers["content-length"], undefined);
      assert.equal(result.headers["content-type"], "text/html");
    } finally {
      server.close();
    }
  });
}

test("a body sent as is keeps its length", async () => {
  const server = await serve((_request, response) => {
    response.writeHead(200, { "content-length": "4" });
    response.end("abcd");
  });

  try {
    const result = await followChecked(`${server.origin}/a.ts`, attempt(), allow);
    assert.equal(result.headers["content-length"], "4");
    assert.equal(await body(result.stream), "abcd");
  } finally {
    server.close();
  }
});

test("a head request announcing gzip has no body to inflate, and ends cleanly", async () => {
  const server = await serve((_request, response) => {
    response.writeHead(200, { "content-encoding": "gzip", "content-length": "120" });
    response.end();
  });

  try {
    const result = await followChecked(
      `${server.origin}/a.mp4`,
      { ...attempt(), method: "HEAD" },
      allow,
    );
    assert.equal(await body(result.stream), "");
    assert.equal(result.headers["content-length"], "120");
  } finally {
    server.close();
  }
});
