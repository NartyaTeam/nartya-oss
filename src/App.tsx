import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import type { Anime } from "./features/anime/anime.ts";
import type { Catalog } from "./features/catalog/catalog.ts";
import type { Progress } from "./features/player/progress.ts";
import type { AuthFlows } from "./features/auth/flows.ts";
import { useSession } from "./features/session/store.ts";
import { getPlatform } from "./lib/platform.ts";
import { LoginPage } from "./pages/LoginPage.tsx";
import { NewPasswordPage } from "./pages/NewPasswordPage.tsx";
import type { ResourceStore } from "./lib/resource-store.ts";
import type { Probe } from "./features/network/store.ts";
import { SignedIn } from "./SignedIn.tsx";

// Without the desktop bridge the provider sends the browser back to this page, code in the
// query string. The flow it belongs to is carried there too, since nothing else survives.
function useBrowserCallback(flows: AuthFlows, onRecovery: () => void): void {
  // A second exchange of the same code fails, and the callback handler is rebuilt on every
  // render, so the attempt is what has to be remembered.
  const attempted = useRef(false);

  useEffect(() => {
    if (getPlatform() || attempted.current) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code")) return;

    attempted.current = true;
    const recovery = url.searchParams.get("flow") === "recovery";
    void flows.exchange(url.href).then(({ error }) => {
      window.history.replaceState({}, "", "/");
      if (!error && recovery) onRecovery();
    });
  }, [flows, onRecovery]);
}

export type AppParts = {
  client: SupabaseClient;
  flows: AuthFlows;
  catalog: Catalog | null;
  anime: Anime | null;
  progress: Progress;
  store: ResourceStore;
  reachable: Probe | null;
};

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="grain" aria-hidden="true" />
    </>
  );
}

export function App({ client, flows, catalog, anime, progress, store, reachable }: AppParts) {
  const { session, profile, ready, watch } = useSession();
  const [recovering, setRecovering] = useState(false);

  useEffect(() => watch(client), [client, watch]);

  // The main process owns the api address and needs the session to unseal a stream; it has
  // no way of its own to learn the token.
  const accessToken = session?.access_token ?? null;
  useEffect(() => {
    void getPlatform()?.stream.session(accessToken);
  }, [accessToken]);
  useBrowserCallback(flows, () => setRecovering(true));

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
        Chargement…
      </main>
    );
  }

  if (session && recovering) {
    return (
      <Screen>
        <NewPasswordPage flows={flows} onDone={() => setRecovering(false)} />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <LoginPage flows={flows} onRecovery={() => setRecovering(true)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SignedIn
        session={session}
        profile={profile}
        catalog={catalog}
        anime={anime}
        progress={progress}
        store={store}
        reachable={reachable}
        onSignOut={() => void flows.signOut()}
      />
    </Screen>
  );
}
