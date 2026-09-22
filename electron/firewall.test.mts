import assert from "node:assert/strict";
import { test } from "node:test";
import { readFirewallStatus } from "./firewall.mts";

test("reads a blocked inbound rule on the current network", () => {
  const status = readFirewallStatus(
    JSON.stringify({ block: ["Private"], allow: [], networks: ["Private"] }),
  );
  assert.deepEqual(status, { blocked: true, publicNetwork: false, allowedOnNetwork: false });
});

test("a rule on Any covers every profile", () => {
  const status = readFirewallStatus(
    JSON.stringify({ block: [], allow: ["Any"], networks: ["Public"] }),
  );
  assert.deepEqual(status, { blocked: false, publicNetwork: true, allowedOnNetwork: true });
});

test("a rule on another profile leaves this network alone", () => {
  const status = readFirewallStatus(
    JSON.stringify({ block: ["Domain"], allow: ["Domain"], networks: ["Private"] }),
  );
  assert.deepEqual(status, { blocked: false, publicNetwork: false, allowedOnNetwork: false });
});

test("powershell collapses a single value instead of writing an array", () => {
  const status = readFirewallStatus(
    JSON.stringify({ block: "Private", allow: null, networks: "Private" }),
  );
  assert.deepEqual(status, { blocked: true, publicNetwork: false, allowedOnNetwork: false });
});

test("gives up on output that is not json", () => {
  assert.equal(readFirewallStatus(""), null);
  assert.equal(readFirewallStatus("Get-NetFirewallRule : not recognized"), null);
});
