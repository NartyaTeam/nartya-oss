import assert from "node:assert/strict";
import { test } from "node:test";
import { explainCastFailure } from "./cast-failure.mts";

test("an unreachable device points at the network, not the file", () => {
  const failure = explainCastFailure("connect", false, null);
  assert.match(failure.error, /même réseau/);
  assert.equal(failure.mediaFailed, undefined);
});

test("a refused launch asks to try again", () => {
  assert.match(explainCastFailure("launch", false, null).error, /Réessaie/);
});

test("a video the television fetched and could not play is worth another source", () => {
  const failure = explainCastFailure("load", true, null);
  assert.equal(failure.mediaFailed, true);
});

test("a load nobody came for names the firewall when it is blocking", () => {
  const blocked = { blocked: true, publicNetwork: false, allowedOnNetwork: false };
  assert.match(explainCastFailure("load", false, blocked).error, /pare-feu Windows/);
});

test("a public network the app is not allowed on blocks just as much", () => {
  const exposed = { blocked: false, publicNetwork: true, allowedOnNetwork: false };
  assert.match(explainCastFailure("load", false, exposed).error, /pare-feu Windows/);

  const allowed = { blocked: false, publicNetwork: true, allowedOnNetwork: true };
  assert.match(explainCastFailure("load", false, allowed).error, /VPN/);
});

test("with nothing known about the firewall, both are worth checking", () => {
  const failure = explainCastFailure("load", false, null);
  assert.match(failure.error, /pare-feu/);
  assert.match(failure.error, /VPN/);
  assert.equal(failure.mediaFailed, undefined);
});
