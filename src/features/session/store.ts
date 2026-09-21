import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

type SessionState = {
  session: Session | null;
  ready: boolean;
  watch: (client: SupabaseClient) => () => void;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  ready: false,
  watch: (client) => {
    void client.auth.getSession().then(({ data }) => set({ session: data.session, ready: true }));
    const { data } = client.auth.onAuthStateChange((_event, session) => set({ session }));
    return () => data.subscription.unsubscribe();
  },
}));
