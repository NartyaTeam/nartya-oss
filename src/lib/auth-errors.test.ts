import assert from "node:assert/strict";
import { test } from "node:test";
import { translateAuthError } from "./auth-errors.ts";

test("names what the person can act on", () => {
  assert.match(translateAuthError("Invalid login credentials"), /mot de passe incorrect/);
  assert.match(translateAuthError("User already registered"), /existe déjà/);
  assert.match(translateAuthError("Email not confirmed"), /Confirme/);
  assert.match(translateAuthError("Password should be at least 6 characters"), /6 caractères/);
  assert.match(translateAuthError("pwned password"), /fuites de données/);
  assert.match(translateAuthError("Email rate limit exceeded"), /Trop de tentatives/);
  assert.match(translateAuthError("Failed to fetch"), /Pas de connexion/);
});

test("covers the recovery flow, which the previous app never had", () => {
  assert.match(translateAuthError("Token has expired or is invalid"), /lien a expiré/);
  assert.match(
    translateAuthError("New password should be different from the old password"),
    /déjà celui du compte/,
  );
});

test("falls back rather than showing a raw gotrue message", () => {
  assert.equal(translateAuthError("boom"), "Une erreur est survenue. Réessaie.");
  assert.equal(translateAuthError(null), "Une erreur est survenue. Réessaie.");
  assert.equal(translateAuthError(undefined), "Une erreur est survenue. Réessaie.");
});

test("a browser that did not open is not blamed on the network", () => {
  assert.equal(
    translateAuthError("browser did not open"),
    "Le navigateur n'a pas pu s'ouvrir. Réessaie.",
  );
});
