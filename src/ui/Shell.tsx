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
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <span className="font-display text-lg font-bold tracking-wide text-text">Nartya</span>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `text-sm transition ${isActive ? "text-text" : "text-muted hover:text-text"}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span>{profile?.username ?? email ?? ""}</span>
            <button className="transition hover:text-primary" onClick={onSignOut}>
              Se déconnecter
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl animate-fade-in px-6 py-8">{children}</main>
    </div>
  );
}
