import { CheckSquare, ImageOff, Play, Square } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Watched } from "../../player/progress.ts";
import { flagFor } from "../flags.ts";
import { languageLabel } from "../languages.ts";
import type { Episode } from "../types.ts";
import { Flag } from "./Flag.tsx";

type RowProps = {
  episode: Episode;
  lang: string;
  country: string | null;
  poster: string | null;
  to: string;
  watched: Watched | undefined;
  action: ReactNode;
  // While picking episodes to download, a row selects instead of opening the player.
  picking: { picked: boolean; toggle: () => void } | null;
};

function EpisodeRow(props: RowProps) {
  const { episode, lang, country, poster, to, watched, action, picking } = props;
  const image = episode.thumbnail ?? poster;
  const started = watched !== undefined && !watched.completed && watched.percent > 0;

  const body = (
    <>
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
          {episode.shown}
        </span>
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.62rem] font-bold backdrop-blur-sm">
          <Flag code={flagFor(lang, country)} />
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
    </>
  );

  return (
    <div className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/[0.04]">
      {picking ? (
        <button
          type="button"
          onClick={picking.toggle}
          className="flex min-w-0 flex-1 gap-3 text-left"
        >
          {body}
        </button>
      ) : (
        <Link to={to} className="flex min-w-0 flex-1 gap-3">
          {body}
        </Link>
      )}
      {picking ? (
        <span className={picking.picked ? "px-2 text-primary" : "px-2 text-muted"}>
          {picking.picked ? <CheckSquare size={20} /> : <Square size={20} />}
        </span>
      ) : (
        // A fixed slot: the button changes width with its state and its percentage, and the
        // text beside it would move with every tick.
        action && <div className="flex w-28 shrink-0 justify-end">{action}</div>
      )}
    </div>
  );
}

type ListProps = {
  episodes: Episode[];
  lang: string;
  country: string | null;
  poster: string | null;
  watchUrl: (episode: Episode) => string;
  watched: Record<string, Watched>;
  seasonId: string;
  action: (episode: Episode) => ReactNode;
  picked: Set<number> | null;
  onPick: (episode: Episode) => void;
};

export function EpisodeList(props: ListProps) {
  const { episodes, lang, country, poster, watchUrl, watched, seasonId, picked } = props;
  return (
    <div className="flex flex-col gap-1">
      {episodes.map((episode) => (
        <EpisodeRow
          key={episode.number}
          episode={episode}
          lang={lang}
          country={country}
          poster={poster}
          to={watchUrl(episode)}
          watched={watched[`${seasonId}:${String(episode.number)}`]}
          action={props.action(episode)}
          picking={
            picked
              ? { picked: picked.has(episode.number), toggle: () => props.onPick(episode) }
              : null
          }
        />
      ))}
    </div>
  );
}
