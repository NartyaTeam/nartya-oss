import type Artplayer from "artplayer";
import { flagFor, flagHtml } from "../anime/flags.ts";
import { languageLabel } from "../anime/languages.ts";

export function showLanguageMenu(
  art: Artplayer,
  languages: string[],
  current: string,
  country: string | null,
  onPick: (lang: string) => void,
): void {
  if (languages.length < 2) {
    if (art.setting.find("language")) art.setting.remove("language");
    return;
  }
  const flagged = (lang: string): string =>
    `<span class="inline-flex items-center gap-2">${flagHtml(flagFor(lang, country))}${languageLabel(lang)}</span>`;

  art.setting.update({
    name: "language",
    width: 200,
    html: "Langue",
    icon: flagHtml(flagFor(current, country)),
    tooltip: languageLabel(current),
    selector: languages.map((lang) => ({
      html: flagged(lang),
      value: lang,
      default: lang === current,
    })),
    // Artplayer shows whatever this returns as the setting's tooltip.
    onSelect: (item) => {
      if (typeof item.value !== "string") return;
      if (item.value !== current) onPick(item.value);
      return languageLabel(item.value);
    },
  });
}
