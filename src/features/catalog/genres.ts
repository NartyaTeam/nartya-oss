// AniList names its genres in english, the catalogue browses them in french. Every one of
// the eighteen has an equivalent, but an unknown name must not become a dead link.
const BROWSE: Record<string, string> = {
  Action: "Action",
  Adventure: "Aventure",
  Comedy: "Comédie",
  Drama: "Drame",
  Ecchi: "Ecchi",
  Fantasy: "Fantasy",
  Horror: "Horreur",
  "Mahou Shoujo": "Magical girl",
  Mecha: "Mechas",
  Music: "Musique",
  Mystery: "Mystère",
  Psychological: "Psychologique",
  Romance: "Romance",
  "Sci-Fi": "Science-fiction",
  "Slice of Life": "Slice of Life",
  Sports: "Sport",
  Supernatural: "Surnaturel",
  Thriller: "Thriller",
};

export function browseGenreFor(genre: string): string | null {
  return BROWSE[genre] ?? null;
}
