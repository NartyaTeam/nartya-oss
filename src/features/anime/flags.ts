import { baseLanguage } from "./languages.ts";

export type FlagCode = "FR" | "EN" | "JP" | "CN" | "KR" | "TW";

const DUBS: Record<string, FlagCode> = {
  vf: "FR",
  vqc: "FR",
  va: "EN",
  vastfr: "EN",
  vj: "JP",
  vkr: "KR",
  vcn: "CN",
};
const ORIGINS: FlagCode[] = ["JP", "CN", "KR", "TW"];

// A dub shows the country of its audio. An original version shows where the work comes
// from, which is not always Japan: a donghua is Chinese.
export function flagFor(lang: string, country: string | null): FlagCode {
  const dub = DUBS[baseLanguage(lang)];
  if (dub) return dub;
  return ORIGINS.find((code) => code === country) ?? "JP";
}

function star(cx: number, cy: number, outer: number, inner: number, tips: number): string {
  const points = Array.from({ length: tips * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / tips - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `<polygon points="${points.join(" ")}"/>`;
}

function trigram(x: number, y: number, turn: number): string {
  const bars = [-1.25, 0, 1.25].map(
    (dy) => `<rect x="-1.6" y="${String(dy - 0.3)}" width="3.2" height="0.6"/>`,
  );
  return `<g transform="translate(${String(x)} ${String(y)}) rotate(${String(turn)})">${bars.join("")}</g>`;
}

// Drawn on a 24 by 16 box.
const DRAWINGS: Record<FlagCode, string> = {
  FR: '<rect width="24" height="16" fill="#fff"/><rect width="8" height="16" fill="#0055A4"/><rect x="16" width="8" height="16" fill="#EF4135"/>',
  EN: '<rect width="24" height="16" fill="#fff"/><rect x="10" width="4" height="16" fill="#CE1124"/><rect y="6" width="24" height="4" fill="#CE1124"/>',
  JP: '<rect width="24" height="16" fill="#fff"/><circle cx="12" cy="8" r="4.8" fill="#BC002D"/>',
  CN:
    '<rect width="24" height="16" fill="#EE1C25"/><g fill="#FFFF00">' +
    star(4, 4, 2.4, 0.92, 5) +
    star(8, 1.6, 0.8, 0.31, 5) +
    star(9.6, 3.2, 0.8, 0.31, 5) +
    star(9.6, 5.6, 0.8, 0.31, 5) +
    star(8, 7.2, 0.8, 0.31, 5) +
    "</g>",
  KR:
    '<rect width="24" height="16" fill="#fff"/>' +
    '<g transform="rotate(33.7 12 8)"><circle cx="12" cy="8" r="4" fill="#003478"/>' +
    '<path d="M8 8a4 4 0 0 1 8 0a2 2 0 0 1-4 0a2 2 0 0 0-4 0z" fill="#CD2E3A"/></g>' +
    '<g fill="#000">' +
    trigram(4.5, 3.2, -56.3) +
    trigram(19.5, 3.2, 56.3) +
    trigram(4.5, 12.8, 56.3) +
    trigram(19.5, 12.8, -56.3) +
    "</g>",
  TW:
    '<rect width="24" height="16" fill="#FE0000"/><rect width="12" height="8" fill="#000095"/>' +
    '<g fill="#fff">' +
    star(6, 4, 3, 1.7, 12) +
    '</g><circle cx="6" cy="4" r="1.5" fill="#000095"/><circle cx="6" cy="4" r="1.25" fill="#fff"/>',
};

// Sized in em so that it follows the player's text, which grows in fullscreen.
export function flagHtml(code: FlagCode): string {
  return (
    '<span class="inline-block h-[1em] w-[1.5em] shrink-0 overflow-hidden rounded-[0.2em] leading-none ring-1 ring-black/20">' +
    `<svg viewBox="0 0 24 16" width="100%" height="100%" class="block">${DRAWINGS[code]}</svg>` +
    "</span>"
  );
}
