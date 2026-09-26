import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { encodeFrame, frameReader, OP } from "./discord-frames.mts";
import type { Activity } from "./discord-presence.mts";
import { createDiscordLink, discordPipes } from "./discord.mts";

let count = 0;
const pipePath = (): string => {
  count += 1;
  const name = `nartya-discord-test-${String(process.pid)}-${String(count)}`;
  return process.platform === "win32" ? `\\\\?\\pipe\\${name}` : join(tmpdir(), `${name}.sock`);
};

type Frame = { op: number; payload: Record<string, unknown> };

// Plays Discord: answers the handshake with READY and records what the app sends.
async function fakeDiscord(path: string, ready = true) {
  const frames: Frame[] = [];
  const sockets: Socket[] = [];
  const waiters: (() => void)[] = [];
  const server: Server = createServer((socket) => {
    sockets.push(socket);
    socket.on(
      "data",
      frameReader((op, payload) => {
        frames.push({ op, payload: payload as Record<string, unknown> });
        if (op === OP.handshake && ready) {
          socket.write(encodeFrame(OP.frame, { cmd: "DISPATCH", evt: "READY" }));
        }
        for (const wake of waiters.splice(0)) wake();
      }),
    );
  });
  await new Promise<void>((done) => server.listen(path, done));

  const until = async (check: () => boolean): Promise<void> => {
    while (!check()) await new Promise<void>((wake) => waiters.push(wake));
  };
  const close = (): Promise<void> => {
    for (const socket of sockets) socket.destroy();
    return new Promise((done) => server.close(() => done()));
  };
  return { frames, sockets, until, close };
}

const activity: Activity = {
  details: "Regarde One Piece",
  state: "Épisode 12",
  timestamps: { start: 1 },
  assets: { large_image: "nartya_logo", large_text: "One Piece" },
  instance: false,
};

const sets = (frames: Frame[]) => frames.filter((frame) => frame.payload["cmd"] === "SET_ACTIVITY");

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

test("the first pipe that answers gets the handshake, then the activity once ready", async () => {
  const path = pipePath();
  const discord = await fakeDiscord(path);
  const link = createDiscordLink({ pipes: [pipePath(), path], pid: 7 });

  link.set(activity);
  link.start("123");
  await discord.until(() => sets(discord.frames).length === 1);

  assert.deepEqual(discord.frames[0], { op: OP.handshake, payload: { v: 1, client_id: "123" } });
  assert.deepEqual(sets(discord.frames)[0]?.payload["args"], { pid: 7, activity });
  link.stop();
  await discord.close();
});

test("nothing is sent before Discord says it is ready", async () => {
  const path = pipePath();
  const discord = await fakeDiscord(path, false);
  const link = createDiscordLink({ pipes: [path], pid: 7 });

  link.start("123");
  await discord.until(() => discord.frames.length === 1);
  link.set(activity);
  await pause(50);

  assert.equal(sets(discord.frames).length, 0);
  link.stop();
  await discord.close();
});

test("clearing sends the activity out", async () => {
  const path = pipePath();
  const discord = await fakeDiscord(path);
  const link = createDiscordLink({ pipes: [path], pid: 7 });

  link.start("123");
  await discord.until(() => sets(discord.frames).length === 1);
  link.set(activity);
  link.set(null);
  await discord.until(() => sets(discord.frames).length === 3);

  assert.deepEqual(sets(discord.frames)[2]?.payload["args"], { pid: 7 });
  link.stop();
  await discord.close();
});

test("a ping is answered with the same payload", async () => {
  const path = pipePath();
  const discord = await fakeDiscord(path);
  const link = createDiscordLink({ pipes: [path], pid: 7 });

  link.start("123");
  await discord.until(() => sets(discord.frames).length === 1);
  discord.sockets[0]?.write(encodeFrame(OP.ping, { n: 3 }));
  await discord.until(() => discord.frames.some((frame) => frame.op === OP.pong));

  assert.deepEqual(discord.frames.find((frame) => frame.op === OP.pong)?.payload, { n: 3 });
  link.stop();
  await discord.close();
});

test("Discord closing and coming back gets the activity again", async () => {
  const path = pipePath();
  const discord = await fakeDiscord(path);
  const link = createDiscordLink({ pipes: [path], pid: 7, reconnectMs: 10 });

  link.set(activity);
  link.start("123");
  await discord.until(() => sets(discord.frames).length === 1);
  discord.sockets[0]?.destroy();
  await discord.until(() => sets(discord.frames).length === 2);

  assert.equal(discord.frames.filter((frame) => frame.op === OP.handshake).length, 2);
  assert.deepEqual(sets(discord.frames)[1]?.payload["args"], { pid: 7, activity });
  link.stop();
  await discord.close();
});

test("with Discord absent the link keeps trying, and stops when asked", async () => {
  const path = pipePath();
  const link = createDiscordLink({ pipes: [path], pid: 7, reconnectMs: 10 });
  link.start("123");
  await pause(30);

  const discord = await fakeDiscord(path);
  await discord.until(() => sets(discord.frames).length === 1);
  link.stop();
  await pause(30);

  assert.equal(discord.sockets.length, 1);
  assert.equal(discord.sockets[0]?.destroyed, true);
  await discord.close();
});

test("ten pipes, named as Discord names them on each system", () => {
  const windows = discordPipes("win32", {});
  assert.equal(windows.length, 10);
  assert.equal(windows[0], "\\\\?\\pipe\\discord-ipc-0");
  assert.equal(
    discordPipes("linux", { XDG_RUNTIME_DIR: "/run/user/1000" })[9],
    join("/run/user/1000", "discord-ipc-9"),
  );
  assert.equal(discordPipes("darwin", {})[0], join("/tmp", "discord-ipc-0"));
});
