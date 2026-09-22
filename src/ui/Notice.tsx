export function Notice({ kind, children }: { kind: "error" | "info"; children: string }) {
  const tone =
    kind === "error"
      ? "border-red-900/60 bg-red-950/40 text-red-200"
      : "border-neutral-800 bg-neutral-900 text-neutral-300";

  return <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>{children}</p>;
}
