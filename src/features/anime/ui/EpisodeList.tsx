import { ImageOff, Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Watched } from "../../player/progress.ts";
import { languageLabel } from "../languages.ts";
import type { Episode } from "../types.ts";

// Numbers can be fractional: a named special sits between two episodes rather than taking
// a number of its own.
const displayNumber = (episode: Episode): string =>
  episode.special ? "SP" : String(Math.round(episode.number * 1000) / 1000);

type RowProps = {
  episode: Episode;
  lang: string;
  poster: string | null;
  to: string;
  watched: Watched | undefined;
};

function EpisodeRow({ episode, lang, poster, to, watched }: RowProps) {
  const image = episode.thumbnail ?? poster;
  const started = watched !== undefined && !watched.completed && watched.percent > 0;

  return (
    <Link
      to={to}
      className="group flex gap-3 rounded-lg p-2 transition-colors hover:bg-white/[0.04]"
    >
      <div
        className={`relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-surface-2 sm:w-48 ${
          started ? "ring-2 ring-primary/70" : ""
        }`}
      >
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            draggable={false}
            className={`h-full w-full object-cover ${watched?.completed === true ? "brightness-75 saturate-50" : ""}`}
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

        <div className="absolute inset-0 hidden items-center justify-center opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100 md:flex">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-fg">
            <Play size={16} className="ml-0.5 fill-current" />
          </span>
        </div>

        {watched && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div
              className={watched.completed ? "h-full bg-accent" : "h-full bg-primary"}
              style={{ width: `${String(watched.percent)}%` }}
            />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-text transition-colors group-hover:text-primary sm:text-base">
          {episode.title}
        </h3>
        {episode.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
            {episode.description}
          </p>
        )}
      </div>
    </Link>
  );
}

type ListProps = {
  episodes: Episode[];
  lang: string;
  poster: string | null;
  watchUrl: (episode: Episode) => string;
  watched: Record<string, Watched>;
  seasonId: string;
};

export function EpisodeList({ episodes, lang, poster, watchUrl, watched, seasonId }: ListProps) {
  return (
    <div className="flex flex-col gap-1">
      {episodes.map((episode) => (
        <EpisodeRow
          key={episode.number}
          episode={episode}
          lang={lang}
          poster={poster}
          to={watchUrl(episode)}
          watched={watched[`${seasonId}:${String(episode.number)}`]}
        />
      ))}
    </div>
  );
}
