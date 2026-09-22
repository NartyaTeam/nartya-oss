import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  size?: "sm" | "lg";
};

const STYLES = {
  primary: "bg-primary font-bold text-primary-fg hover:bg-primary/90",
  ghost: "bg-white/[0.07] font-medium text-text backdrop-blur hover:bg-white/[0.12]",
};

const SIZES = { sm: "px-4 py-2 text-sm", lg: "px-6 py-3" };

export function Button({
  variant = "primary",
  size = "sm",
  className = "",
  ...button
}: ButtonProps) {
  return (
    <button
      {...button}
      className={`inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-200 disabled:opacity-50 ${STYLES[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
