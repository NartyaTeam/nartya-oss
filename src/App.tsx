import { useEffect, useState } from "react";
import type { AppInfo } from "../shared/platform";
import { getPlatform } from "./platform";

export function App() {
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-100">
      <h1 className="text-2xl font-semibold">Nartya</h1>
      <p className="text-sm text-neutral-400">
        {info ? `version ${info.version} — ${info.platform}` : "navigateur"}
      </p>
    </main>
  );
}
