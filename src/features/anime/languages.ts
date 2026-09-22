const LABELS: Record<string, string> = {
  vf: "VF",
  vostfr: "VOSTFR",
  va: "VA",
  vo: "VO",
  vastfr: "VASTFR",
  vj: "VJ",
  vkr: "VKR",
  vcn: "VCN",
  vqc: "VQC",
};

export const DEFAULT_LANGUAGE = "vostfr";

// A second dub of the same language is numbered: vf1, vf2, va1.
const base = (lang: string): string => lang.toLowerCase().replace(/\d+$/, "");

export function languageLabel(lang: string): string {
  const known = LABELS[lang.toLowerCase()];
  if (known) return known;

  const numbered = /^([a-z]+)(\d+)$/.exec(lang.toLowerCase());
  const root = numbered?.[1] ? LABELS[numbered[1]] : undefined;
  return root ? `${root} ${numbered?.[2] ?? ""}`.trim() : lang.toUpperCase();
}

// A season may only carry vf1 and vf2 where vf was asked for: the numbered variant is the
// same dub, and dropping to the first language on the list would silently change it.
export function pickLanguage(available: string[], wanted: string): string {
  if (available.includes(wanted)) return wanted;
  const variant = available.find((lang) => base(lang) === base(wanted));
  return variant ?? available[0] ?? wanted;
}
