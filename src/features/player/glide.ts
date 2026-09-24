import type Artplayer from "artplayer";

const GLIDE_MS = 700;

// The video jumps in one seek, which buffers once; only the bar travels to where it lands.
export function glideProgress(player: Artplayer): void {
  const parts: [string, string][] = [
    [".art-progress-played", "width"],
    [".art-progress-indicator", "left"],
  ];
  for (const [selector, property] of parts) {
    const part = player.template.$player.querySelector<HTMLElement>(selector);
    if (!part) continue;
    part.style.transition = `${property} ${String(GLIDE_MS)}ms ease-out`;
    window.setTimeout(() => (part.style.transition = ""), GLIDE_MS);
  }
}
