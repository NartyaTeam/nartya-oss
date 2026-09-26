import { Heart } from "lucide-react";
import type { Favorite, Favorites } from "./favorites.ts";
import { useFavorites } from "./store.ts";

type FavoriteButtonProps = { api: Favorites; favorite: Favorite };

export function FavoriteButton({ api, favorite }: FavoriteButtonProps) {
  const known = useFavorites((state) => state.items !== null);
  const on = useFavorites(
    (state) => state.items?.some((entry) => entry.slug === favorite.slug) ?? false,
  );
  const failed = useFavorites((state) =>
    state.failed?.slug === favorite.slug ? state.failed.message : null,
  );
  const toggle = useFavorites((state) => state.toggle);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => void toggle(api, favorite)}
        disabled={!known}
        aria-pressed={on}
        title={on ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={`flex h-12 w-12 items-center justify-center rounded-md ring-1 transition-colors disabled:opacity-40 ${
          on
            ? "bg-primary/15 text-primary ring-primary/40 hover:bg-primary/25"
            : "bg-white/[0.06] text-muted ring-white/10 hover:bg-white/[0.1] hover:text-primary"
        }`}
      >
        <Heart size={20} className={on ? "fill-current" : ""} />
      </button>
      {failed && (
        <p className="absolute right-0 top-full mt-2 w-60 text-right text-xs text-primary">
          {failed}
        </p>
      )}
    </div>
  );
}
