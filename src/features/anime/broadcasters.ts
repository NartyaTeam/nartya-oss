const KNOWN: Record<string, { name: string; free?: boolean }> = {
  "france.tv": { name: "France TV", free: true },
  "6play.fr": { name: "6play", free: true },
  "tf1.fr": { name: "TF1+", free: true },
  "arte.tv": { name: "ARTE", free: true },
  "youtube.com": { name: "YouTube", free: true },
  "crunchyroll.com": { name: "Crunchyroll" },
  "animationdigitalnetwork.fr": { name: "ADN" },
  "adn.tv": { name: "ADN" },
  "netflix.com": { name: "Netflix" },
  "disneyplus.com": { name: "Disney+" },
  "primevideo.com": { name: "Prime Video" },
};

export function broadcasterName(host: string): string {
  const known = KNOWN[host];
  if (known) return known.name;
  const label = host.split(".")[0] ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "le diffuseur";
}

export function isFreeToWatch(host: string): boolean {
  return KNOWN[host]?.free === true;
}
