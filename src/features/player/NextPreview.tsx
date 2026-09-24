import { ImageOff, Play } from "lucide-react";
import type { Episode } from "../anime/types.ts";

type NextPreviewProps = { episode: Episode; cover: string | null; onPlay: () => void };

// Follows the hover of the next button alone: it is a richer tooltip, not a panel to browse.
export function NextPreview({ episode, cover, onPlay }: NextPreviewProps) {
  const image = episode.thumbnail ?? cover;
  return (
    <button
      type="button"
      onClick={onPlay}
      className="pointer-events-auto absolute bottom-16 right-3 flex w-[min(420px,calc(100%-1.5rem))] animate-fade-in flex-col overflow-hidden rounded-md border border-white/10 bg-[#0e0e0e]/95 text-left text-white shadow-2xl backdrop-blur-md"
    >
      <span className="border-b border-white/10 px-5 py-3.5 text-lg font-bold">Ép. suivant</span>
      <span className="flex items-start gap-3.5 p-3.5">
        <span className="relative aspect-video w-36 shrink-0 overflow-hidden rounded bg-white/5">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-white/30">
              <ImageOff size={20} />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
              <Play size={14} className="ml-0.5 fill-current" />
            </span>
          </span>
        </span>
        <span className="min-w-0 pt-0.5">
          <span className="flex items-baseline gap-2 font-bold">
            <span className="shrink-0">{episode.shown}</span>
            <span className="truncate">{episode.title || `Épisode ${String(episode.number)}`}</span>
          </span>
          {episode.description && (
            <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/65">
              {episode.description}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
