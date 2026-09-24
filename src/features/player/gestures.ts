import type Artplayer from "artplayer";

// Arrow keys seek ten seconds, but artplayer's own step would walk into the very end of
// the episode and fire ended, which chains to the next one on a key repeat.
export const SEEK_STEP_S = 10;
export const END_GUARD_S = 2;
const VOLUME_STEP = 0.05;

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

export function addGestures(player: Artplayer, onSeek: (seconds: number) => void): () => void {
  const seekBy = (seconds: number): void => {
    const { currentTime, duration } = player.video;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const target = Math.min(Math.max(currentTime + seconds, 0), duration - END_GUARD_S);
    if (Math.abs(target - currentTime) < 0.5) return;
    player.currentTime = target;
    onSeek(seconds);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "ArrowRight") seekBy(SEEK_STEP_S);
    else if (event.key === "ArrowLeft") seekBy(-SEEK_STEP_S);
    else if (event.key === "f" || event.key === "F") player.fullscreen = !player.fullscreen;
    else return;
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);

  // Artplayer plays or pauses on the first click of a double click, then only goes fullscreen.
  player.on("dblclick", () => player.toggle());

  const volume = player.template.$player.querySelector<HTMLElement>(".art-control-volume");
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const step = event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP;
    player.volume = Math.min(1, Math.max(0, player.volume + step));
  };
  volume?.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    window.removeEventListener("keydown", onKey);
    volume?.removeEventListener("wheel", onWheel);
  };
}
