import Artplayer from "artplayer";
import Hls from "hls.js";
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { addAnime4kMenu, type Anime4kMenu } from "./anime4k-menu.ts";
import type { Anime4kMode } from "./anime4k-modes.ts";
import { Anime4kWarning } from "./Anime4kWarning.tsx";
import { remember, browserStore } from "./bandwidth.ts";
import { glideProgress } from "./glide.ts";
import { hlsConfigFor } from "./hls-config.ts";
import { showLanguageMenu } from "./language-menu.ts";
import { OUTLINED_ICONS } from "./outlined-icons.ts";
import { applyQuality, showQualityMenu } from "./quality-menu.ts";
import { hasWebGpu } from "./webgpu.ts";

// Arrow keys seek ten seconds, but artplayer's own step would walk into the very end of
// the episode and fire ended, which chains to the next one on a key repeat.
Artplayer.SEEK_STEP = 0;
const SEEK_STEP_S = 10;
const END_GUARD_S = 2;

// Wrapped like artplayer's own icons, which is what scales them up in fullscreen; fill:none
// inline because artplayer fills every svg of the player.
const controlIcon = (name: string, paths: string, cap = "round"): string =>
  `<i class="art-icon art-icon-${name}"><svg width="22" height="22" viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="2" stroke-linecap="${cap}" stroke-linejoin="round">${paths}</svg></i>`;
const NEXT_ICON = controlIcon("next", '<path d="M5 12h14M12 5l7 7-7 7"/>', "butt");
const EPISODES_ICON = controlIcon(
  "episodes",
  '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
);

export type PlayerSource = { url: string; isHls: boolean; host: string | null };

type PlayerProps = {
  source: PlayerSource | null;
  poster: string | null;
  startAt: number;
  title: string;
  hasNext: boolean;
  onNext: () => void;
  onNextHover: (hovered: boolean) => void;
  onEpisodes: (hovered: boolean) => void;
  languages: string[];
  language: string;
  country: string | null;
  onLanguage: (lang: string) => void;
  onTime: (seconds: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
  seek: MutableRefObject<(seconds: number) => void>;
  children?: ReactNode;
};

// One player for the whole page: rebuilding it for each episode would leave fullscreen.
export function Player({
  source,
  poster,
  startAt,
  title,
  hasNext,
  onNext,
  onNextHover,
  onEpisodes,
  languages,
  language,
  country,
  onLanguage,
  onTime,
  onEnded,
  onError,
  seek,
  children,
}: PlayerProps) {
  const box = useRef<HTMLDivElement>(null);
  const [art, setArt] = useState<Artplayer | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [asking, setAsking] = useState<Anime4kMode | null>(null);
  const upscaler = useRef<Anime4kMenu | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const requality = useRef<() => void>(() => undefined);
  // Events from the url before this one describe another episode, until its metadata loads.
  const current = useRef<{ url: string | null; loaded: boolean }>({ url: null, loaded: false });
  // Read inside the player's own callbacks, which outlive the render that created them.
  const latest = useRef({
    startAt,
    onNext,
    onNextHover,
    onEpisodes,
    onLanguage,
    onTime,
    onEnded,
    onError,
  });
  latest.current = {
    startAt,
    onNext,
    onNextHover,
    onEpisodes,
    onLanguage,
    onTime,
    onEnded,
    onError,
  };

  // Primitives, not the object: a caller building it inline would otherwise reload the
  // source on every render, and it would never finish loading.
  const url = source?.url ?? null;
  const isHls = source?.isHls ?? false;
  const host = source?.host ?? null;
  const offered = languages.join(",");

  useEffect(() => {
    const container = box.current;
    if (!container) return;

    const player = new Artplayer({
      container,
      url: "",
      theme: "#FF4A2D",
      lang: "fr",
      volume: 1,
      autoplay: true,
      // Artplayer keys its own resume memory on the url, and every hls episode shares the
      // empty one: it would offer to resume the wrong episode.
      autoPlayback: false,
      setting: true,
      playbackRate: true,
      fullscreen: true,
      pip: true,
      moreVideoAttr: { crossOrigin: "anonymous" },
      controls: [
        {
          name: "title",
          position: "left",
          html: '<span class="block truncate text-sm font-semibold"></span>',
          style: {
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "48%",
            pointerEvents: "none",
          },
        },
        {
          name: "next",
          position: "right",
          index: 7,
          html: NEXT_ICON,
          click: () => latest.current.onNext(),
          mounted: (control) => {
            control.addEventListener("mouseenter", () => latest.current.onNextHover(true));
            control.addEventListener("mouseleave", () => latest.current.onNextHover(false));
          },
        },
        {
          name: "episodes",
          position: "right",
          index: 8,
          html: EPISODES_ICON,
          click: () => latest.current.onEpisodes(true),
          mounted: (control) => {
            control.addEventListener("mouseenter", () => latest.current.onEpisodes(true));
            control.addEventListener("mouseleave", () => latest.current.onEpisodes(false));
          },
        },
      ],
    });

    const store = browserStore();
    requality.current = () => {
      const hls = hlsRef.current;
      if (!hls || hls.levels.length === 0) return;
      const locked = upscaler.current?.active() ?? false;
      applyQuality(hls, store, locked);
      showQualityMenu(player, hls, store, locked);
    };
    upscaler.current = hasWebGpu()
      ? addAnime4kMenu(player, store, setAsking, () => requality.current())
      : null;

    const seekBy = (seconds: number): void => {
      const { currentTime, duration } = player.video;
      if (!Number.isFinite(duration) || duration <= 0) return;
      player.currentTime = Math.min(Math.max(currentTime + seconds, 0), duration - END_GUARD_S);
    };

    const onKey = (event: KeyboardEvent): void => {
      // Arrows belong to whatever is being typed in before they belong to the player.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true) return;
      if (event.key === "ArrowRight") seekBy(SEEK_STEP_S);
      else if (event.key === "ArrowLeft") seekBy(-SEEK_STEP_S);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);

    player.on("video:loadedmetadata", () => {
      current.current.loaded = true;
      const target = latest.current.startAt;
      const { duration } = player.video;
      // Resuming within a few seconds of the end would replay the credits and finish again.
      if (target > 2 && duration > 0 && target < duration - 5) player.currentTime = target;
    });

    player.on("video:timeupdate", () => {
      if (current.current.loaded) latest.current.onTime(player.currentTime, player.duration);
    });

    player.on("video:ended", () => {
      if (current.current.loaded) latest.current.onEnded();
    });

    player.on("video:error", () => {
      if (current.current.url) latest.current.onError();
    });

    // Above Artplayer's loading spinner (70), under its notices and settings (80 and up).
    const layer = document.createElement("div");
    layer.className = `pointer-events-none absolute inset-0 z-[75] ${OUTLINED_ICONS}`;
    player.template.$player.append(layer);
    setOverlay(layer);
    setArt(player);

    return () => {
      window.removeEventListener("keydown", onKey);
      upscaler.current?.stop();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      player.destroy(false);
    };
  }, []);

  useEffect(() => {
    if (!art) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    current.current = { url, loaded: false };
    if (!url) {
      art.pause();
      return;
    }

    if (!isHls || !Hls.isSupported()) {
      art.url = url;
      return;
    }

    const hls = new Hls(hlsConfigFor(host));
    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(art.video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => requality.current());
    // Only a fatal error is the source giving up; hls.js recovers from the rest itself.
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) latest.current.onError();
    });
    // The rolling estimate, not one fragment's: it is what seeds the next launch.
    hls.on(Hls.Events.FRAG_LOADED, () => {
      const measured = hls.bandwidthEstimate;
      if (Number.isFinite(measured)) remember(browserStore(), measured, host);
    });
  }, [art, url, isHls, host]);

  useEffect(() => {
    if (!art) return;
    showLanguageMenu(art, offered ? offered.split(",") : [], language, country, (lang) =>
      latest.current.onLanguage(lang),
    );
  }, [art, offered, language, country]);

  useEffect(() => {
    if (!art) return;
    seek.current = (seconds) => {
      const { duration } = art.video;
      if (!(duration > 0)) return;
      glideProgress(art);
      art.currentTime = Math.min(seconds, duration - END_GUARD_S);
    };
  }, [art, seek]);

  useEffect(() => {
    const label = art?.controls["title"]?.querySelector("span");
    if (label) label.textContent = title;
  }, [art, title]);

  useEffect(() => {
    if (art) art.poster = poster ?? "";
  }, [art, poster]);

  useEffect(() => {
    const control = art?.controls["next"];
    if (control) control.style.display = hasNext ? "" : "none";
  }, [art, hasNext]);

  // Artplayer offers no way to turn off its hover hints outside mobile, nor its notices.
  return (
    <>
      <div
        ref={box}
        className="h-full w-full bg-black [&_.art-notice]:!hidden [&_[class*=hint--]]:before:!hidden [&_[class*=hint--]]:after:!hidden"
      />
      {overlay && children && createPortal(children, overlay)}
      {asking && (
        <Anime4kWarning
          mode={asking}
          onConfirm={() => {
            upscaler.current?.enable(asking);
            setAsking(null);
          }}
          onCancel={() => {
            upscaler.current?.refresh();
            setAsking(null);
          }}
        />
      )}
    </>
  );
}
