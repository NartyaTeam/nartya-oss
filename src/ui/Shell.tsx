import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { Profile } from "../features/session/profile.ts";

type ShellProps = {
  profile: Profile | null;
  email: string | null;
  onSignOut: () => void;
  children: ReactNode;
};

const TABS = [
  { to: "/", label: "Accueil" },
  { to: "/recherche", label: "Rechercher" },
];

export function Shell({ profile, email, onSignOut, children }: ShellProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-900 bg-neutral-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="text-lg font-semibold">Nartya</span>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `text-sm transition ${isActive ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 text-sm text-neutral-400">
            <span>{profile?.username ?? email ?? ""}</span>
            <button className="hover:text-neutral-200" onClick={onSignOut}>
              Se déconnecter
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
