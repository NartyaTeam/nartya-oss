import { ArrowLeft } from "lucide-react";

// Follows the player's controls, except while nothing plays: then it is the only way out.
export function BackButton({ onClick, shown }: { onClick: () => void; shown: boolean }) {
  const visibility = shown
    ? "pointer-events-auto"
    : "pointer-events-none opacity-0 [.art-control-show_&]:pointer-events-auto [.art-control-show_&]:opacity-100 [.art-hover_&]:pointer-events-auto [.art-hover_&]:opacity-100";
  return (
    <button
      type="button"
      aria-label="Retour"
      onClick={onClick}
      className={`absolute left-5 top-5 z-10 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] transition hover:scale-110 ${visibility}`}
    >
      <ArrowLeft size={34} strokeWidth={2.5} strokeLinecap="butt" />
    </button>
  );
}
