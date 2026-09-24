import { Info, SkipForward, X } from "lucide-react";
import { useEffect, useState } from "react";
import { END_CARD_S, type Credits } from "./skip.ts";

const SCENE_NOTICE_MS = 6000;
const BUTTON_ALONE_MS = 5000;

type CreditsControlsProps = {
  credits: Credits | null;
  countdown: number | null;
  dismissed: boolean;
  hasNext: boolean;
  onSkip: (to: number) => void;
  onNext: () => void;
  onDismiss: () => void;
};

const BUTTON =
  "flex items-center gap-2.5 rounded-md border border-white/25 bg-black/60 px-5 py-3 text-[0.95rem] font-semibold text-white shadow-2xl backdrop-blur-md transition hover:border-white/50 hover:bg-black/80";

// Past its first seconds, the skip button comes and goes with the player's controls.
const WITH_CONTROLS =
  "pointer-events-none opacity-0 [.art-control-show_&]:pointer-events-auto [.art-control-show_&]:opacity-100 [.art-hover_&]:pointer-events-auto [.art-hover_&]:opacity-100";

export function CreditsControls(props: CreditsControlsProps) {
  const { credits, countdown, hasNext } = props;
  const kind = credits?.kind ?? null;
  const sceneAfter = kind === "outro" && credits?.sceneAfter === true;
  const [notice, setNotice] = useState(false);
  const [alone, setAlone] = useState(false);

  useEffect(() => {
    if (!sceneAfter) return;
    setNotice(true);
    const id = window.setTimeout(() => setNotice(false), SCENE_NOTICE_MS);
    return () => {
      window.clearTimeout(id);
      setNotice(false);
    };
  }, [sceneAfter]);

  useEffect(() => {
    if (!kind) return;
    setAlone(true);
    const id = window.setTimeout(() => setAlone(false), BUTTON_ALONE_MS);
    return () => window.clearTimeout(id);
  }, [kind]);

  const card = countdown !== null && hasNext && !props.dismissed;
  // Skipping an ending with nothing after it lands on the end of the file: the next
  // episode is where the viewer is going anyway.
  const straightToNext = credits?.kind === "outro" && !credits.sceneAfter && hasNext;

  return (
    <>
      {notice && (
        <div className="absolute right-6 top-6 flex animate-fade-in items-center gap-2 rounded-md bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          <Info size={16} className="shrink-0 text-white/70" />
          Une scène suit le générique
        </div>
      )}

      {credits && !card && (
        <button
          type="button"
          onClick={() => (straightToNext ? props.onNext() : props.onSkip(credits.end))}
          className={`absolute bottom-24 right-6 duration-300 ${BUTTON} ${alone ? "pointer-events-auto" : WITH_CONTROLS}`}
        >
          {credits.kind === "intro"
            ? "Passer l'intro"
            : straightToNext
              ? "Épisode suivant"
              : "Passer l'ending"}
          <SkipForward size={17} className="text-white/70" />
        </button>
      )}

      {card && (
        <div className="absolute bottom-24 right-6 flex animate-fade-in items-center gap-3">
          <button
            type="button"
            onClick={props.onNext}
            className={`pointer-events-auto relative overflow-hidden ${BUTTON}`}
          >
            <span
              className="absolute inset-y-0 left-0 bg-primary/35 transition-[width] duration-1000 ease-linear"
              style={{ width: `${String(((END_CARD_S - countdown) / END_CARD_S) * 100)}%` }}
            />
            <span className="relative">Épisode suivant</span>
            <span className="relative w-9 tabular-nums text-white/60">{countdown}s</span>
          </button>
          <button
            type="button"
            onClick={props.onDismiss}
            aria-label="Annuler l'enchaînement"
            className="pointer-events-auto text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition-transform hover:scale-110"
          >
            <X size={30} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </>
  );
}
