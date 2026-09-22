import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Field({ label, ...input }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <input
        {...input}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-text outline-none transition placeholder:text-muted/60 focus:border-primary/70 disabled:opacity-60"
      />
    </label>
  );
}
