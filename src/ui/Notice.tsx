export function Notice({ kind, children }: { kind: "error" | "info"; children: string }) {
  const tone =
    kind === "error"
      ? "border-primary/40 bg-primary/10 text-sakura"
      : "border-line bg-surface text-muted";

  return <p className={`rounded-xl border px-3 py-2 text-sm ${tone}`}>{children}</p>;
}
