import { useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "../features/session/profile.ts";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

type ShellProps = {
  profile: Profile | null;
  email: string | null;
  onSignOut: () => void;
  children: ReactNode;
};

const HALO = "radial-gradient(80% 50% at 80% -10%, rgb(255 74 45 / 0.14), transparent 60%)";

export function Shell({ profile, email, onSignOut, children }: ShellProps) {
  const [scrolled, setScrolled] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-text">
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: HALO }} />
      <Sidebar profile={profile} email={email} onSignOut={onSignOut} />
      <main
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 40)}
        className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden"
      >
        <TopBar scrolled={scrolled} />
        {/* The page rises under the transparent bar, which is what lets the hero pass below it. */}
        <div className="-mt-16">{children}</div>
      </main>
    </div>
  );
}
