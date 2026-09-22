import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { loadProfile, supabaseProfiles, type Profile, type ProfileSource } from "./profile.ts";

export type SessionState = {
  session: Session | null;
  profile: Profile | null;
  ready: boolean;
  watch: (client: SupabaseClient, profiles?: ProfileSource) => () => void;
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  profile: null,
  ready: false,

  watch: (client, profiles = supabaseProfiles(client)) => {
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

    // onAuthStateChange fires INITIAL_SESSION once the client holds its token, so the
    // profile is never read before the request would carry it.
    const { data } = client.auth.onAuthStateChange((_event, session) => void hydrate(session));
    return () => data.subscription.unsubscribe();
  },
}));
