import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { ProfileSource } from "./profile.ts";
import { useSession } from "./store.ts";

type Emit = (session: Session | null) => void;

function sessionFor(id: string): Session {
  return { access_token: "token", user: { id } } as Session;
}

function fakeClient() {
  const state = { signOuts: 0, unsubscribes: 0 };
  let emit: Emit = () => {};

  const client = {
    auth: {
      onAuthStateChange: (handler: (event: string, session: Session | null) => void) => {
        emit = (session) => handler("INITIAL_SESSION", session);
        return {
          data: { subscription: { unsubscribe: () => void (state.unsubscribes += 1) } },
        };
      },
      signOut: async () => {
        state.signOuts += 1;
        emit(null);
      },
    },
  } as unknown as SupabaseClient;

  return { client, state, emit: (session: Session | null) => emit(session) };
}

function fakeProfiles(rows: Record<string, unknown>, gone = false) {
  const reads: string[] = [];
  const source: ProfileSource = {
    fetch: async (userId) => {
      reads.push(userId);
      return { row: rows[userId] ?? null, failed: false };
    },
    confirmUser: async () => (gone ? "gone" : "valid"),
    touch: async () => {},
  };
  return { source, reads };
}

const settled = () => new Promise((done) => setTimeout(done, 0));

// One store for the whole module, so each test starts from a known state.
const fresh = () => useSession.setState({ session: null, profile: null, ready: false });

test("becomes ready with no session, and reads no profile", async () => {
  fresh();
  const { client, state, emit } = fakeClient();
  const profiles = fakeProfiles({});
  const stop = useSession.getState().watch(client, profiles.source);

  emit(null);
  await settled();
  assert.equal(useSession.getState().ready, true);
  assert.equal(useSession.getState().session, null);
  assert.deepEqual(profiles.reads, []);

  stop();
  assert.equal(state.unsubscribes, 1);
});

test("loads the profile once per signed in account", async () => {
  fresh();
  const { client, emit } = fakeClient();
  const profiles = fakeProfiles({ u1: { id: "u1", username: "zeleff" } });
  const stop = useSession.getState().watch(client, profiles.source);

  emit(sessionFor("u1"));
  await settled();
  assert.equal(useSession.getState().profile?.username, "zeleff");

  emit(sessionFor("u1"));
  await settled();
  assert.deepEqual(profiles.reads, ["u1"], "a token refresh is not a reason to read it again");

  emit(sessionFor("u2"));
  await settled();
  assert.deepEqual(profiles.reads, ["u1", "u2"]);

  stop();
});

test("signing out clears the profile", async () => {
  fresh();
  const { client, emit } = fakeClient();
  const profiles = fakeProfiles({ u1: { id: "u1", username: "zeleff" } });
  const stop = useSession.getState().watch(client, profiles.source);

  emit(sessionFor("u1"));
  await settled();
  emit(null);
  await settled();

  assert.equal(useSession.getState().session, null);
  assert.equal(useSession.getState().profile, null);
  stop();
});

test("an account deleted on the server is signed out here", async () => {
  fresh();
  const { client, state, emit } = fakeClient();
  const profiles = fakeProfiles({}, true);
  const stop = useSession.getState().watch(client, profiles.source);

  emit(sessionFor("u1"));
  await settled();

  assert.equal(state.signOuts, 1);
  assert.equal(useSession.getState().session, null);
  assert.equal(useSession.getState().profile, null);
  stop();
});
