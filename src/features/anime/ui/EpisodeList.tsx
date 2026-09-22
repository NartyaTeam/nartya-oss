import { ImageOff } from "lucide-react";
import { languageLabel } from "../languages.ts";
import type { Episode } from "../types.ts";

// Numbers can be fractional: a named special sits between two episodes rather than taking
// a number of its own.
const displayNumber = (episode: Episode): string =>
  episode.special ? "SP" : String(Math.round(episode.number * 1000) / 1000);

function EpisodeRow({
  episode,
  lang,
  poster,
}: {
  episode: Episode;
  lang: string;
  poster: string | null;
}) {
  const image = episode.thumbnail ?? poster;

  return (
    <article className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.04]">
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-48">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageOff size={20} />
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold backdrop-blur-sm">
          {displayNumber(episode)}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold backdrop-blur-sm">
          {languageLabel(lang)}
        </span>
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-text sm:text-base">
          {episode.title}
        </h3>
        {episode.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
            {episode.description}
          </p>
        )}
      </div>
    </article>
  );
}

type ListProps = { episodes: Episode[]; lang: string; poster: string | null };

export function EpisodeList({ episodes, lang, poster }: ListProps) {
  return (
    <div className="flex flex-col gap-1">
      {episodes.map((episode) => (
        <EpisodeRow key={episode.number} episode={episode} lang={lang} poster={poster} />
      ))}
    </div>
  );
}
