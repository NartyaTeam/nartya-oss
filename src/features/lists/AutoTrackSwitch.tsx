import { Timer } from "lucide-react";
import { useLists } from "./store.ts";

export function AutoTrackSwitch() {
  const on = useLists((state) => state.autoTrack);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => useLists.getState().setAutoTrack(!on)}
      title="Un anime regardé plus de 2 minutes s'ajoute à « En cours » s'il n'est dans aucune liste."
      className="flex items-center gap-2.5 rounded-full bg-surface py-1.5 pl-3 pr-1.5 text-xs ring-1 ring-line transition-colors hover:ring-white/15"
    >
      <Timer size={14} className={on ? "text-primary" : "text-muted"} />
      <span className="font-medium text-text">Ajout auto. après 2 min</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full ring-1 transition-colors ${
          on ? "bg-primary ring-primary" : "bg-white/15 ring-white/10"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-text transition-transform ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
