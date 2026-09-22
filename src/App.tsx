import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import type { AppInfo } from "../shared/platform.ts";
import type { AuthFlows } from "./features/auth/flows.ts";
import { useSession } from "./features/session/store.ts";
import { getPlatform } from "./lib/platform.ts";
import { HomePage } from "./pages/HomePage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { NewPasswordPage } from "./pages/NewPasswordPage.tsx";

function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    const platform = getPlatform();
    if (!platform) return;
    let active = true;
    void platform.getAppInfo().then((value) => {
      if (active) setInfo(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return info;
}

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

export function App({ client, flows }: { client: SupabaseClient; flows: AuthFlows }) {
  const { session, profile, ready, watch } = useSession();
  const [recovering, setRecovering] = useState(false);
  const info = useAppInfo();

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
    <HomePage
      session={session}
      profile={profile}
      info={info}
      onSignOut={() => void flows.signOut()}
    />
  );
}
