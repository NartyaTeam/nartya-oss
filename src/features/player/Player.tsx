import Artplayer from "artplayer";
import Hls from "hls.js";
import { useEffect, useRef } from "react";
import { remember, browserBandwidth } from "./bandwidth.ts";
import { hlsConfigFor } from "./hls-config.ts";

// Arrow keys seek ten seconds, but artplayer's own step would walk into the very end of
// the episode and fire ended, which chains to the next one on a key repeat.
Artplayer.SEEK_STEP = 0;
const SEEK_STEP_S = 10;
const END_GUARD_S = 2;

export type PlayerSource = { url: string; isHls: boolean; host: string | null };

type PlayerProps = {
  source: PlayerSource;
  poster: string | null;
  startAt: number;
  onTime: (seconds: number, duration: number) => void;
  onEnded: () => void;
  onError: () => void;
};

export function Player({ source, poster, startAt, onTime, onEnded, onError }: PlayerProps) {
  const box = useRef<HTMLDivElement>(null);
  // Primitives, not the object: a caller building it inline would otherwise tear the
  // player down and rebuild it on every render, and it would never finish loading.
  const { url, isHls, host } = source;
  // Read inside the player's own callbacks, which outlive the render that created them.
  const latest = useRef({ startAt, onTime, onEnded, onError });
  latest.current = { startAt, onTime, onEnded, onError };

  useEffect(() => {
    const container = box.current;
    if (!container) return;

    const art = new Artplayer({
      container,
      url: isHls ? "" : url,
      poster: poster ?? "",
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
    });

    let hls: Hls | null = null;

    const seekBy = (seconds: number): void => {
      const { currentTime, duration } = art.video;
      if (!Number.isFinite(duration) || duration <= 0) return;
      art.currentTime = Math.min(Math.max(currentTime + seconds, 0), duration - END_GUARD_S);
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

    art.on("video:loadedmetadata", () => {
      const target = latest.current.startAt;
      const { duration } = art.video;
      // Resuming within a few seconds of the end would replay the credits and finish again.
      if (target > 2 && duration > 0 && target < duration - 5) art.currentTime = target;
    });

    art.on("video:timeupdate", () => {
      latest.current.onTime(art.currentTime, art.duration);
    });

    art.on("video:ended", () => {
      latest.current.onEnded();
    });

    art.on("video:error", () => {
      latest.current.onError();
    });

    if (isHls && Hls.isSupported()) {
      hls = new Hls(hlsConfigFor(host));
      hls.loadSource(url);
      hls.attachMedia(art.video);

      const attached = hls;
      // Only a fatal error is the source giving up; hls.js recovers from the rest itself.
      attached.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) latest.current.onError();
      });

      // The rolling estimate, not one fragment's: it is what seeds the next launch.
      attached.on(Hls.Events.FRAG_LOADED, () => {
        const measured = attached.bandwidthEstimate;
        if (Number.isFinite(measured)) remember(browserBandwidth(), measured, host);
      });
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      hls?.destroy();
      art.destroy(false);
    };
  }, [url, isHls, host, poster]);

  return <div ref={box} className="aspect-video w-full bg-black" />;
}
