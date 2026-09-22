import { Button } from "./Button.tsx";

type PagerProps = { page: number; hasMore: boolean; onGo: (page: number) => void };

export function Pager({ page, hasMore, onGo }: PagerProps) {
  if (page === 1 && !hasMore) return null;

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" disabled={page === 1} onClick={() => onGo(page - 1)}>
        Page précédente
      </Button>
      <span className="text-sm text-muted">Page {page}</span>
      <Button variant="ghost" disabled={!hasMore} onClick={() => onGo(page + 1)}>
        Page suivante
      </Button>
    </div>
  );
}
