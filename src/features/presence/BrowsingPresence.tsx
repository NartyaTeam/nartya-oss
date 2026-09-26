import { useLocation } from "react-router-dom";
import { usePresence } from "./usePresence.ts";

// The anime and watch pages say what they show; everywhere else is browsing.
export function BrowsingPresence() {
  const { pathname } = useLocation();
  const owned = pathname.startsWith("/anime/") || pathname.startsWith("/watch/");
  usePresence(owned ? null : { kind: "browsing" });
  return null;
}
