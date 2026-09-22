import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../features/session/profile.ts";
import type { AppInfo } from "../../shared/platform.ts";
import { Button } from "../ui/Button.tsx";

type HomeProps = {
  session: Session;
  profile: Profile | null;
  info: AppInfo | null;
  onSignOut: () => void;
};

// A landing place until the catalog arrives: what it shows is what slice 1 is responsible
// for, an account that is really signed in.
export function HomePage({ session, profile, info, onSignOut }: HomeProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-neutral-100">
      <h1 className="text-2xl font-semibold">Nartya</h1>
      <p className="text-sm text-neutral-300">
        {profile?.username ?? session.user.email ?? "compte sans email"}
      </p>
      <p className="text-sm text-neutral-500">
        {info ? `version ${info.version} — ${info.platform}` : "navigateur"}
      </p>
      <Button variant="ghost" onClick={onSignOut}>
        Se déconnecter
      </Button>
    </main>
  );
}
