import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function Field({ label, ...input }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-300">{label}</span>
      <input
        {...input}
        className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-600 disabled:opacity-60"
      />
    </label>
  );
}
