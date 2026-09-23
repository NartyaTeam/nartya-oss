import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "../../ui/Button.tsx";

export function PlayerStatus({
  note,
  busy,
  onRetry,
}: {
  note: string;
  busy?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
      {busy ? (
        <Loader2 size={28} className="animate-spin text-muted" />
      ) : (
        <AlertTriangle size={32} className="text-primary" />
      )}
      <p className="max-w-md text-sm text-muted">{note}</p>
      {onRetry && (
        <Button className="pointer-events-auto" onClick={onRetry}>
          <RotateCcw size={16} />
          Réessayer
        </Button>
      )}
    </div>
  );
}
