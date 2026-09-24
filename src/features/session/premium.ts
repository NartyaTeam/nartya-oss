import type { Profile } from "./profile.ts";

export type Tier = "plus" | "ultimate";

// Granted by an admin on the profile row; a tier with no end date is for life.
export function activeTier(profile: Profile | null, now: number): Tier | null {
  const tier = profile?.premiumTier;
  if (tier !== "plus" && tier !== "ultimate") return null;
  const until = profile?.premiumUntil ? Date.parse(profile.premiumUntil) : Number.NaN;
  if (profile?.premiumUntil && !(until > now)) return null;
  return tier;
}

export function downloadSlots(tier: Tier | null): number {
  if (tier === "ultimate") return 99;
  return tier === "plus" ? 5 : 2;
}
