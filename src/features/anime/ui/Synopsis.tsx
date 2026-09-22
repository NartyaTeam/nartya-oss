import { ChevronDown, Languages } from "lucide-react";
import { useState } from "react";

const CUTOFF = 420;

type SynopsisProps = { text: string; translated: boolean };

export function Synopsis({ text, translated }: SynopsisProps) {
  const [open, setOpen] = useState(false);
  const long = text.length > CUTOFF;

  return (
    <div className="mt-4 max-w-3xl">
      <p className="whitespace-pre-line text-sm leading-relaxed text-text/85">
        {long && !open ? `${text.slice(0, CUTOFF)}…` : text}
      </p>
      {long && (
        <button
          onClick={() => setOpen(!open)}
          className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          {open ? "Voir moins" : "Voir plus"}
          <ChevronDown size={15} className={open ? "rotate-180" : ""} />
        </button>
      )}
      {translated && (
        <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted/70">
          <Languages size={13} className="mt-px shrink-0" />
          Ce synopsis n'est pas encore disponible en français — il s'affiche en anglais en
          attendant.
        </p>
      )}
    </div>
  );
}
