import { useEffect, useRef } from "react";
import { getPlatform } from "../../lib/platform.ts";
import { presenceFor, type Doing } from "./presence.ts";

// Discord takes five activity updates every twenty seconds: quick navigation would spend them.
const SETTLE_MS = 500;

let site: string | null = null;
let started = false;

export function startPresence(clientId: string | null, siteUrl: string | null): void {
  const bridge = getPlatform()?.discord;
  if (!clientId || !bridge) return;
  site = siteUrl;
  started = true;
  void bridge.start(clientId);
}

export function usePresence(doing: Doing | null): void {
  const key = doing ? JSON.stringify(doing) : "";
  const latest = useRef(doing);
  latest.current = doing;

  useEffect(() => {
    const current = latest.current;
    if (!started || !current) return;
    const id = setTimeout(() => {
      void getPlatform()?.discord.set(presenceFor(current, site));
    }, SETTLE_MS);
    return () => clearTimeout(id);
  }, [key]);
}
