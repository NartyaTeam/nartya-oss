import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SeekHud } from "./seek-hud.ts";

const DELAYS = ["0s", "0.12s", "0.24s"];

export function SeekIndicator({ hud }: { hud: SeekHud | null }) {
  if (!hud) return null;
  const Chevron = hud.forward ? ChevronRight : ChevronLeft;
  // The chevrons light up in the direction of the seek.
  const delays = hud.forward ? DELAYS : [...DELAYS].reverse();
  const chevrons = (
    <span className="flex translate-y-0.5">
      {delays.map((delay) => (
        <Chevron
          key={delay}
          size={26}
          strokeWidth={3}
          className="-mx-[7px] animate-chevron"
          style={{ animationDelay: delay }}
        />
      ))}
    </span>
  );

  return (
    <div
      className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-3.5 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${hud.forward ? "right-[8%]" : "left-[8%]"}`}
    >
      {!hud.forward && chevrons}
      <span className="text-[34px] font-extrabold leading-none">{hud.seconds}s</span>
      {hud.forward && chevrons}
    </div>
  );
}
