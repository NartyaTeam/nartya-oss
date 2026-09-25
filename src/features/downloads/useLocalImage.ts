import { useEffect, useState } from "react";
import { getPlatform } from "../../lib/platform.ts";

// The copy saved with the download shows with no network; the remote one is the fallback.
export function useLocalImage(id: string, file: string | null, remote: string | null) {
  const [local, setLocal] = useState<{ key: string; url: string | null } | null>(null);
  const key = `${id}/${file ?? ""}`;

  useEffect(() => {
    const bridge = getPlatform()?.downloads;
    if (!file || !bridge) return;
    let live = true;
    void bridge.localUrl(id, file).then((url) => {
      if (live) setLocal({ key, url });
    });
    return () => {
      live = false;
    };
  }, [id, file, key]);

  return (local?.key === key ? local.url : null) ?? remote;
}
