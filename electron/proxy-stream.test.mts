import assert from "node:assert/strict";
import type http from "node:http";
import { test } from "node:test";
import { fail } from "./proxy-stream.mts";

function recorder(headersSent: boolean) {
  const calls: string[] = [];
  const response = {
    headersSent,
    destroy: () => calls.push("destroy"),
    writeHead: () => calls.push("writeHead"),
    end: () => calls.push("end"),
  };
  return { calls, response: response as unknown as http.ServerResponse };
}

test("answers with a status while the body has not started", () => {
  const { calls, response } = recorder(false);
  fail(response, 502, "Flux interrompu");
  assert.deepEqual(calls, ["writeHead", "end"]);
});

test("closes a response already in flight rather than leaving the player waiting", () => {
  const { calls, response } = recorder(true);
  fail(response, 502, "Flux interrompu");
  assert.deepEqual(calls, ["destroy"]);
});
