import assert from "node:assert/strict";
import { test } from "node:test";
import { readPresence, toActivity } from "./discord-presence.mts";

const presence = {
  details: "Regarde One Piece",
  state: "Épisode 12",
  largeText: "One Piece",
  buttons: [{ label: "Regarder cet anime", url: "https://site.test/open?anime=one-piece" }],
};

test("a presence from the app is read as sent", () => {
  assert.deepEqual(readPresence(presence), presence);
});

test("anything but a presence clears it", () => {
  assert.equal(readPresence(null), null);
  assert.equal(readPresence("home"), null);
  assert.equal(readPresence({ ...presence, details: 1 }), null);
  assert.equal(readPresence({ ...presence, buttons: "x" }), null);
});

test("texts are cut to what Discord accepts", () => {
  const long = readPresence({ ...presence, details: "a".repeat(200), state: "b".repeat(200) });
  assert.equal(long?.details.length, 128);
  assert.equal(long?.state.length, 128);
});

test("only two https buttons with a short label go through", () => {
  const read = readPresence({
    ...presence,
    buttons: [
      { label: "a".repeat(40), url: "https://site.test/a" },
      { label: "Local", url: "file:///etc/passwd" },
      { label: "b", url: "https://site.test/b" },
      { label: "c", url: "https://site.test/c" },
    ],
  });
  assert.deepEqual(read?.buttons, [
    { label: "a".repeat(32), url: "https://site.test/a" },
    { label: "b", url: "https://site.test/b" },
  ]);
});

test("the activity carries the logo, the start time, and buttons only when there are some", () => {
  const activity = toActivity({ ...presence, buttons: [] }, 1_000);
  assert.deepEqual(activity, {
    details: "Regarde One Piece",
    state: "Épisode 12",
    timestamps: { start: 1_000 },
    assets: { large_image: "nartya_logo", large_text: "One Piece" },
    instance: false,
  });
  assert.equal(toActivity(presence, 1_000).buttons?.length, 1);
});
