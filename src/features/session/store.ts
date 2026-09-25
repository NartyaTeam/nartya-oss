import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { loadProfile, supabaseProfiles, type Profile, type ProfileSource } from "./profile.ts";
import { readStoredSession } from "./stored.ts";

export type SessionState = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  watch: (
    client: SupabaseClient,
    profiles?: ProfileSource,
    stored?: () => Session | null,
  ) => () => void;
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  profile: null,
  ready: false,

  watch: (client, profiles = supabaseProfiles(client), stored = readStoredSession) => {
    async function hydrate(session: Session | null): Promise<void> {
      const previous = get().session;
      set({ session, ready: true });
      if (!session?.user) {
        set({ profile: null });
        return;
      }
      if (previous?.user.id === session.user.id && get().profile) return;

      const { profile, signOut } = await loadProfile(profiles, session.user.id);
      // The account was deleted on the server while a valid token was still in hand.
      if (signOut) {
        await client.auth.signOut();
        return;
      }
      if (profile) set({ profile });
    }

    // The client only answers once it has tried to refresh the token, up to half a minute
    // with no network. The profile still waits for it, so its request carries the token.
    const seeded = stored();
    if (seeded) set({ session: seeded, ready: true });

    const { data } = client.auth.onAuthStateChange((event, session) => {
      // A refresh that failed for want of network leaves the session stored; a revoked
      // one is removed. Only the first means the viewer is still signed in.
      if (!session && event === "INITIAL_SESSION" && stored()) return;
      void hydrate(session);
    });
    return () => data.subscription.unsubscribe();
  },
}));
