import { ArrowUpRight, Megaphone, Play, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../ui/Button.tsx";
import { browseGenreFor } from "../../catalog/genres.ts";
import { broadcasterName, isFreeToWatch } from "../broadcasters.ts";
import type { AnimeMeta, AnimePage, Broadcaster } from "../types.ts";
import { Synopsis } from "./Synopsis.tsx";

const TAG = "rounded bg-white/[0.06] px-2.5 py-1 text-xs text-text";

function Genres({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {genres.map((genre) => {
        const browse = browseGenreFor(genre);
        return browse ? (
          <Link
            key={genre}
            to={`/genre/${encodeURIComponent(browse)}`}
            className={`${TAG} transition-colors hover:bg-white/[0.1] hover:text-primary`}
          >
            {genre}
          </Link>
        ) : (
          <span key={genre} className={TAG}>
            {genre}
          </span>
        );
      })}
    </div>
  );
}

// Not hosted here: the page points at the broadcaster that has the rights rather than at an
// empty list of episodes.
function Broadcasters({ list }: { list: Broadcaster[] }) {
  const [first, ...rest] = list;
  if (!first) return null;

  return (
    <div className="mt-5 max-w-3xl rounded-md bg-primary/[0.06] p-4 ring-1 ring-primary/20">
      <p className="text-sm text-muted">
        Cette œuvre est proposée par son diffuseur officiel
        {isFreeToWatch(first.host) ? ", gratuitement" : ""}.
      </p>
      <a
        href={first.url}
        target="_blank"
        rel="noreferrer"
        className="group mt-3 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.08] px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary/50 hover:bg-primary hover:text-primary-fg"
      >
        Voir sur {broadcasterName(first.host)}
        <ArrowUpRight size={15} aria-hidden="true" />
      </a>
      {rest.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/50 pt-3">
          <span className="text-xs text-muted/60">Aussi disponible sur</span>
          {rest.map((broadcaster) => (
            <a
              key={broadcaster.host}
              href={broadcaster.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              {broadcasterName(broadcaster.host)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

type MetaProps = { meta: AnimeMeta | null; status: string | null; airing: boolean };

function MetaLine({ meta, status, airing }: MetaProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
      {meta?.score !== null && meta?.score !== undefined && (
        <span className="flex items-center gap-1 font-semibold text-accent">
          <Star size={14} className="fill-accent" />
          AniList {meta.score.toFixed(1)}/10
        </span>
      )}
      {meta?.year !== null && meta?.year !== undefined && <span>{meta.year}</span>}
      {meta?.format && <span className="uppercase">{meta.format}</span>}
      {meta?.episodes !== null && meta?.episodes !== undefined && <span>{meta.episodes} ép.</span>}
      {status && (
        <span className={`flex items-center gap-1.5 ${airing ? "font-medium text-primary" : ""}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${airing ? "bg-primary" : "bg-muted"}`} />
          {status}
        </span>
      )}
    </div>
  );
}

type HeaderProps = {
  page: AnimePage;
  seasonCover: string | null;
  seasonSynopsis: string | null;
  resume: { to: string; label: string } | null;
  actions: ReactNode;
};

export function AnimeHeader({ page, seasonCover, seasonSynopsis, resume, actions }: HeaderProps) {
  const { anime, meta, images } = page;
  const poster = seasonCover ?? images?.poster ?? anime.poster;
  const banner = images?.fanart ?? images?.banner;
  const altTitle = anime.alternativeTitles[0] ?? meta?.titleNative;
  const airing = anime.status ? /en\s*cours/i.test(anime.status) : false;

  const synopsis = seasonSynopsis ?? anime.synopsis ?? meta?.description ?? "";
  // Only the third source can be english: a season synopsis and the anime-sama text are
  // french by construction. Without the api saying so, nothing is claimed.
  const translated =
    !seasonSynopsis && !anime.synopsis && meta?.descriptionLang === "en" && synopsis !== "";

  return (
    <header>
      <div className="relative h-[300px] w-full overflow-hidden md:h-[380px]">
        {banner ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${banner})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/70 to-transparent" />
      </div>

      <div className="relative z-10 -mt-44 flex flex-col gap-8 px-4 md:flex-row md:px-14">
        <div className="w-56 shrink-0 self-start md:w-60">
          <div className="overflow-hidden rounded-lg shadow-card ring-1 ring-white/10">
            {poster ? (
              <img src={poster} alt={anime.title} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="aspect-[2/3] w-full bg-surface-2" />
            )}
          </div>
          {resume && (
            <Link to={resume.to} className="mt-3 block">
              <Button className="h-12 w-full whitespace-nowrap">
                <Play size={18} className="shrink-0 fill-current" />
                {resume.label}
              </Button>
            </Link>
          )}
          <div className="mt-2 flex gap-2">{actions}</div>
        </div>

        <div className="flex-1 pt-2 md:pt-20">
          {images?.clearLogo ? (
            <img
              src={images.clearLogo}
              alt={anime.title}
              className="block max-h-36 max-w-[80%] md:max-h-44"
            />
          ) : (
            <h1 className="text-glow font-display text-4xl font-extrabold leading-tight md:text-5xl">
              {anime.title}
            </h1>
          )}
          {altTitle && altTitle !== anime.title && <p className="mt-1.5 text-muted">{altTitle}</p>}

          <MetaLine meta={meta} status={anime.status} airing={airing} />

          {anime.news && (
            <div className="mt-4 flex w-fit max-w-3xl items-start gap-2.5 rounded-md bg-primary/[0.08] px-3.5 py-2.5 text-sm text-text/90 ring-1 ring-primary/20">
              <Megaphone size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="font-semibold text-primary">Actualité : </span>
                {anime.news}
              </span>
            </div>
          )}

          <Genres genres={meta?.genres ?? []} />
          {/* Keyed on the text: unfolded on one card, it must not arrive unfolded on the next. */}
          {synopsis && <Synopsis key={synopsis} text={synopsis} translated={translated} />}
          <Broadcasters list={anime.externalWatch} />
        </div>
      </div>
    </header>
  );
}
