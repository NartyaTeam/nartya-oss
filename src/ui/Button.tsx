import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

const STYLES = {
  primary: "bg-primary text-primary-fg hover:shadow-glow",
  ghost: "border border-line text-text hover:border-primary/60 hover:text-primary",
};

export function Button({ variant = "primary", ...button }: ButtonProps) {
  return (
    <button
      {...button}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${STYLES[variant]}`}
    />
  );
}
