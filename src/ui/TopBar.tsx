import { ArrowLeft, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// The bar floats over the hero and only takes a veil once the page has moved under it.
export function TopBar({ scrolled }: { scrolled: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [term, setTerm] = useState("");

  useEffect(() => setTerm(""), [pathname]);

  const showBack = pathname.startsWith("/genre/") || pathname.startsWith("/anime/");
  const showSearch = pathname !== "/recherche";

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/recherche?q=${encodeURIComponent(query)}` : "/recherche");
  }

  return (
    <header
      className={`app-drag pointer-events-none sticky top-0 z-40 flex h-16 items-center px-4 transition-colors duration-300 md:px-8 ${
        scrolled ? "border-b border-line/70 bg-bg/85 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          title="Retour"
          className="app-no-drag pointer-events-auto flex items-center gap-2 rounded-md bg-black/40 px-3 py-2.5 text-sm font-medium ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Retour</span>
        </button>
      )}

      {showSearch && (
        <form
          onSubmit={submit}
          className="app-no-drag pointer-events-auto relative ml-auto w-full max-w-md"
        >
          <div className="flex items-center gap-2 rounded-md bg-black/40 px-3.5 py-2.5 shadow-sm ring-1 ring-white/15 backdrop-blur-md transition focus-within:bg-black/55 focus-within:ring-primary/60">
            <Search size={17} className="text-muted" />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Rechercher un anime…"
              className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
            {term && (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label="Effacer"
                className="text-muted transition-colors hover:text-text"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </form>
      )}
    </header>
  );
}
