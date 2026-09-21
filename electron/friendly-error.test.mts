import assert from "node:assert/strict";
import { test } from "node:test";
import { friendlyErrorMessage } from "./friendly-error.mts";

test("names the cancellation rather than a failure", () => {
  assert.equal(friendlyErrorMessage({ name: "AbortError" }), "Téléchargement annulé");
});

test("reads the code first, then the message", () => {
  assert.equal(friendlyErrorMessage({ code: "ECONNREFUSED" }), "Serveur injoignable");
  assert.equal(
    friendlyErrorMessage({ message: "socket hang up" }),
    "Connexion interrompue, réessaie",
  );
  assert.equal(friendlyErrorMessage({ cause: { code: "ENOTFOUND" } }), "Hébergeur introuvable");
});

test("maps http statuses to what the user can act on", () => {
  assert.equal(friendlyErrorMessage({ message: "HTTP 403" }), "Accès refusé par l'hébergeur");
  assert.equal(
    friendlyErrorMessage({ message: "HTTP 404" }),
    "Fichier introuvable sur l'hébergeur",
  );
  assert.equal(
    friendlyErrorMessage({ message: "HTTP 429" }),
    "Trop de requêtes, réessaie dans un instant",
  );
  assert.equal(friendlyErrorMessage({ message: "HTTP 503" }), "Hébergeur indisponible");
  assert.equal(friendlyErrorMessage({ message: "HTTP 418" }), "Erreur de l'hébergeur");
});

test("never leaks a technical message", () => {
  assert.equal(
    friendlyErrorMessage(new Error("ETIMEDOUT at socket.js:42")),
    "Le serveur ne répond pas, réessaie plus tard",
  );
  assert.equal(
    friendlyErrorMessage(new Error("something nobody planned for")),
    "Échec du téléchargement",
  );
  assert.equal(friendlyErrorMessage(null), "Erreur inconnue");
});
