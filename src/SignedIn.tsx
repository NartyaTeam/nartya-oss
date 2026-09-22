import type { Session } from "@supabase/supabase-js";
import { HashRouter, Route, Routes } from "react-router-dom";
import type { Catalog } from "./features/catalog/catalog.ts";
import type { Profile } from "./features/session/profile.ts";
import type { ResourceStore } from "./lib/resource-store.ts";
import { CatalogHomePage } from "./pages/CatalogHomePage.tsx";
import { GenrePage } from "./pages/GenrePage.tsx";
import { SearchPage } from "./pages/SearchPage.tsx";
import { Empty } from "./ui/Empty.tsx";
import { Shell } from "./ui/Shell.tsx";

type SignedInProps = {
  session: Session;
  profile: Profile | null;
  catalog: Catalog | null;
  store: ResourceStore;
  onSignOut: () => void;
};

// Hash routing, because the packaged app is served from file:// where a path based history
// has nothing to resolve against.
export function SignedIn({ session, profile, catalog, store, onSignOut }: SignedInProps) {
  return (
    <HashRouter>
      <Shell profile={profile} email={session.user.email ?? null} onSignOut={onSignOut}>
        {catalog ? (
          <Routes>
            <Route path="/" element={<CatalogHomePage catalog={catalog} store={store} />} />
            <Route path="/recherche" element={<SearchPage catalog={catalog} store={store} />} />
            <Route path="/genre/:genre" element={<GenrePage catalog={catalog} store={store} />} />
            <Route
              path="*"
              element={<Empty title="Page inconnue" note="Ce lien ne mène nulle part." />}
            />
          </Routes>
        ) : (
          <Empty
            title="Catalogue non configuré"
            note="Renseigne VITE_API_BASE pour lire un catalogue. Le catalogue de démonstration arrivera avec le lecteur."
          />
        )}
      </Shell>
    </HashRouter>
  );
}
