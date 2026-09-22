import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

const STYLES = {
  primary: "bg-neutral-100 text-neutral-900 hover:bg-white",
  ghost: "border border-neutral-800 text-neutral-200 hover:border-neutral-600",
};

export function Button({ variant = "primary", ...button }: ButtonProps) {
  return (
    <button
      {...button}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${STYLES[variant]}`}
    />
  );
}
