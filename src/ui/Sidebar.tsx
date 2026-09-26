import { Clapperboard, Download, Heart, LogOut, Search, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import type { Profile } from "../features/session/profile.ts";
import { getPlatform } from "../lib/platform.ts";

const TRANS = "250ms cubic-bezier(0.4,0,0.2,1)";

const TABS: { to: string; icon: LucideIcon; label: string }[] = [
  { to: "/", icon: Clapperboard, label: "Animes" },
  { to: "/recherche", icon: Search, label: "Recherche" },
  { to: "/favoris", icon: Heart, label: "Favoris" },
];

// Downloads need the desktop app: in a browser the entry would lead nowhere useful.
const DOWNLOADS = { to: "/telechargements", icon: Download, label: "Téléchargements" };

type ItemProps = { to: string; icon: LucideIcon; label: string; expanded: boolean };

function Item({ to, icon: Icon, label, expanded }: ItemProps) {
  return (
    <NavLink
      to={to}
      end
      title={expanded ? undefined : label}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-md px-[15px] py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-white/[0.06] text-primary"
            : "text-muted hover:bg-white/[0.04] hover:text-text"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 bg-primary" />
          )}
          <Icon size={18} strokeWidth={2} className="shrink-0" />
          <span
            className="flex-1 whitespace-nowrap"
            style={{ opacity: expanded ? 1 : 0, transition: `opacity ${TRANS}` }}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

type SidebarProps = { profile: Profile | null; email: string | null; onSignOut: () => void };

// The rail keeps a stable 64px in the flow and the panel expands over the page, so opening
// it reflows nothing.
export function Sidebar({ profile, email, onSignOut }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const fade = { opacity: expanded ? 1 : 0, transition: `opacity ${TRANS}` };
  const name = profile?.username ?? email ?? "—";

  return (
    <div className="relative z-30 hidden w-16 shrink-0 md:block">
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-line/60 bg-bg"
        style={{
          width: expanded ? "240px" : "64px",
          transition: `width ${TRANS}`,
          contain: "layout paint",
          boxShadow: expanded ? "4px 0 20px rgba(0,0,0,0.25)" : "none",
        }}
      >
        <div className="app-drag flex h-[84px] shrink-0 items-center gap-3 px-[14px]">
          <img src="icon.png" alt="Nartya" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0 leading-none" style={fade}>
            <p className="whitespace-nowrap font-display text-lg font-extrabold tracking-wide">
              NARTYA
            </p>
            <p className="mt-1 whitespace-nowrap text-[0.6rem] uppercase tracking-kana text-muted">
              アニメ
            </p>
          </div>
        </div>

        <nav className="app-no-drag flex flex-1 flex-col gap-0.5 px-2">
          {TABS.map((tab) => (
            <Item key={tab.to} {...tab} expanded={expanded} />
          ))}
          {getPlatform() && <Item {...DOWNLOADS} expanded={expanded} />}
        </nav>

        <div className="app-no-drag flex items-center gap-3 border-t border-line/60 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={16} />
            )}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={fade}>
            {name}
          </p>
          <button
            onClick={onSignOut}
            title="Se déconnecter"
            className="shrink-0 text-muted transition-colors hover:text-primary"
            style={{ ...fade, pointerEvents: expanded ? "auto" : "none" }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </div>
  );
}
