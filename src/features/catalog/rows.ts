// Two AniList seasons of the same show share one streaming slug, so a row can carry the
// same card twice: two covers that open the same page.
export function dedupeBySlug<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });
}
