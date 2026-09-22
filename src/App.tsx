import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import type { Catalog } from "./features/catalog/catalog.ts";
import type { AuthFlows } from "./features/auth/flows.ts";
import { useSession } from "./features/session/store.ts";
import { getPlatform } from "./lib/platform.ts";
import { LoginPage } from "./pages/LoginPage.tsx";
import { NewPasswordPage } from "./pages/NewPasswordPage.tsx";
import type { ResourceStore } from "./lib/resource-store.ts";
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
  store: ResourceStore;
};

export function App({ client, flows, catalog, store }: AppParts) {
  const { session, profile, ready, watch } = useSession();
  const [recovering, setRecovering] = useState(false);

  useEffect(() => watch(client), [client, watch]);
  useBrowserCallback(flows, () => setRecovering(true));

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">
        Chargement…
      </main>
    );
  }

  if (session && recovering) {
    return <NewPasswordPage flows={flows} onDone={() => setRecovering(false)} />;
  }
  if (!session) {
    return <LoginPage flows={flows} onRecovery={() => setRecovering(true)} />;
  }

  return (
    <SignedIn
      session={session}
      profile={profile}
      catalog={catalog}
      store={store}
      onSignOut={() => void flows.signOut()}
    />
  );
}
