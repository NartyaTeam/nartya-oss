import type { Session } from "@supabase/supabase-js";
import { useEffect, type ReactNode } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import type { Anime } from "./features/anime/anime.ts";
import type { Catalog } from "./features/catalog/catalog.ts";
import { useDownloads } from "./features/downloads/store.ts";
import { activeTier, downloadSlots } from "./features/session/premium.ts";
import { getPlatform } from "./lib/platform.ts";
import type { Profile } from "./features/session/profile.ts";
import type { ResourceStore } from "./lib/resource-store.ts";
import type { Progress } from "./features/player/progress.ts";
import { AnimePage } from "./pages/AnimePage.tsx";
import { CatalogHomePage } from "./pages/CatalogHomePage.tsx";
import { DownloadsPage } from "./pages/DownloadsPage.tsx";
import { GenrePage } from "./pages/GenrePage.tsx";
import { SearchPage } from "./pages/SearchPage.tsx";
import { WatchPage } from "./pages/WatchPage.tsx";
import { Empty } from "./ui/Empty.tsx";
import { Shell } from "./ui/Shell.tsx";

type SignedInProps = {
  session: Session;
  profile: Profile | null;
  catalog: Catalog | null;
  anime: Anime | null;
  progress: Progress;
  store: ResourceStore;
  onSignOut: () => void;
};

// Hash routing, because the packaged app is served from file:// where a path based history
// has nothing to resolve against.
export function SignedIn({
  session,
  profile,
  catalog,
  anime,
  progress,
  store,
  onSignOut,
}: SignedInProps) {
  useEffect(() => useDownloads.getState().watch(), []);
  const slots = downloadSlots(activeTier(profile, Date.now()));
  useEffect(() => {
    void getPlatform()?.downloads.setSlots(slots);
  }, [slots]);

  const shell = (content: ReactNode) => (
    <Shell profile={profile} email={session.user.email ?? null} onSignOut={onSignOut}>
      {content}
    </Shell>
  );

  if (!catalog || !anime) {
    return (
      <HashRouter>
        {shell(
          <div className="px-4 pt-16 sm:px-8">
            <Empty
              title="Catalogue non configuré"
              note="Renseigne VITE_API_BASE pour lire un catalogue. Le catalogue de démonstration arrivera avec le lecteur."
            />
          </div>,
        )}
      </HashRouter>
    );
  }

  // The player takes the whole window, outside the shell.
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/watch/:slug"
          element={
            <WatchPage anime={anime} store={store} progress={progress} userId={session.user.id} />
          }
        />
        <Route
          path="*"
          element={shell(
            <Routes>
              <Route path="/" element={<CatalogHomePage catalog={catalog} store={store} />} />
              <Route path="/recherche" element={<SearchPage catalog={catalog} store={store} />} />
              <Route path="/telechargements" element={<DownloadsPage anime={anime} />} />
              <Route path="/genre/:genre" element={<GenrePage catalog={catalog} store={store} />} />
              <Route
                path="/anime/:slug"
                element={
                  <AnimePage
                    anime={anime}
                    store={store}
                    progress={progress}
                    userId={session.user.id}
                  />
                }
              />
              <Route
                path="*"
                element={
                  <div className="px-4 pt-16 sm:px-8">
                    <Empty title="Page inconnue" note="Ce lien ne mène nulle part." />
                  </div>
                }
              />
            </Routes>,
          )}
        />
      </Routes>
    </HashRouter>
  );
}
