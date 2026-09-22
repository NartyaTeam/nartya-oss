import { Button } from "./Button.tsx";

type EmptyProps = { title: string; note: string; onRetry?: () => void };

export function Empty({ title, note, onRetry }: EmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-md text-sm text-neutral-400">{note}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
