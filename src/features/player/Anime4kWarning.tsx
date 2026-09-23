import { Cpu, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../ui/Button.tsx";
import { choiceLabel, type Anime4kMode } from "./anime4k-modes.ts";
import { OUTLINED_ICONS } from "./outlined-icons.ts";

type Anime4kWarningProps = { mode: Anime4kMode; onConfirm: () => void; onCancel: () => void };

export function Anime4kWarning({ mode, onConfirm, onCancel }: Anime4kWarningProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // In fullscreen only the fullscreen element is drawn: a dialog outside it would not show.
  const target = document.fullscreenElement ?? document.body;

  return createPortal(
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${OUTLINED_ICONS}`}>
      <button
        type="button"
        aria-label="Annuler"
        className="absolute inset-0 cursor-default bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="anime4k-title"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <h2 id="anime4k-title" className="font-display text-2xl font-bold">
              Anime4K
            </h2>
            <p className="mt-1 text-sm text-muted">Amélioration de l'image en temps réel</p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onCancel}
            className="rounded-md p-1 text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-4 px-6 pb-6 text-sm leading-relaxed">
          <p>
            Anime4K reconstruit chaque image de l'épisode pour la rendre plus nette. Le calcul se
            fait sur la carte graphique : si elle est trop modeste, la lecture peut saccader.
          </p>
          <div className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-4 py-3">
            <Cpu size={18} className="shrink-0 text-muted" />
            <p className="text-xs">
              <span className="font-semibold">Minimum conseillé :</span> GTX 1060, RX 580 ou Apple
              M1, avec 8 Go de RAM.
            </p>
          </div>
          <p className="text-xs text-muted">
            {choiceLabel(mode)}, résolution doublée. Anime4K se désactive à tout moment dans les
            réglages du lecteur.
          </p>
        </div>

        <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onConfirm} autoFocus>
            Activer
          </Button>
        </footer>
      </section>
    </div>,
    target,
  );
}
