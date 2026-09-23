import type Artplayer from "artplayer";
import type { Store } from "./bandwidth.ts";
import { startAnime4k } from "./anime4k.ts";
import {
  MODES,
  RECOMMENDED_MODE,
  acknowledge,
  choiceLabel,
  isAcknowledged,
  saveChoice,
  savedChoice,
  type Anime4kChoice,
  type Anime4kMode,
} from "./anime4k-modes.ts";

const ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>';

const CHOICES: Anime4kChoice[] = ["off", ...MODES.map((entry) => entry.mode)];

function optionHtml(choice: Anime4kChoice): string {
  const entry = MODES.find((candidate) => candidate.mode === choice);
  if (!entry) return choiceLabel(choice);
  const tag =
    entry.mode === RECOMMENDED_MODE
      ? '<span class="ml-2 text-xs font-semibold text-primary">Recommandé</span>'
      : "";
  return `${entry.name}<span class="ml-2 text-xs opacity-60">${entry.use}</span>${tag}`;
}

export type Anime4kMenu = {
  active: () => boolean;
  enable: (mode: Anime4kMode) => void;
  // Artplayer ticks whatever was clicked, even a mode the viewer then declined.
  refresh: () => void;
  stop: () => void;
};

export function addAnime4kMenu(
  art: Artplayer,
  store: Store,
  onAsk: (mode: Anime4kMode) => void,
  onChange: () => void,
): Anime4kMenu {
  let choice = savedChoice(store);
  let stopRenderer: (() => void) | null = null;

  const run = (): void => {
    stopRenderer?.();
    stopRenderer = null;
    if (choice === "off") return;
    stopRenderer = startAnime4k(art.video, art.template.$player, choice, () => {
      art.notice.show = "Anime4K indisponible sur cette source";
      apply("off");
    });
  };

  const show = (): void => {
    art.setting.update({
      name: "anime4k",
      width: 340,
      html: "Anime4K",
      icon: ICON,
      tooltip: choiceLabel(choice),
      selector: CHOICES.map((entry) => ({
        html: optionHtml(entry),
        value: entry,
        default: entry === choice,
      })),
      // Artplayer shows whatever this returns as the setting's tooltip.
      onSelect: (item) => {
        const picked = CHOICES.find((entry) => entry === item.value);
        if (!picked) return;
        if (picked !== "off" && !isAcknowledged(store)) {
          onAsk(picked);
          return choiceLabel(choice);
        }
        apply(picked);
        return choiceLabel(picked);
      },
    });
  };

  function apply(next: Anime4kChoice): void {
    choice = next;
    saveChoice(store, next);
    run();
    show();
    onChange();
  }

  show();
  run();

  return {
    active: () => choice !== "off",
    enable: (mode) => {
      acknowledge(store);
      apply(mode);
    },
    refresh: show,
    stop: () => {
      stopRenderer?.();
      stopRenderer = null;
    },
  };
}
