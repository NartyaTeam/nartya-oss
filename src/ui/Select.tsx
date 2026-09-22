import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type Option = { value: string; label: string };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  label: string;
  className?: string;
};

const TRIGGER =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-surface pl-3.5 pr-3 text-sm font-medium text-text outline-none ring-1 ring-line transition-colors hover:bg-surface-2 focus:ring-primary/60 data-[state=open]:ring-primary/60";

// The native menu is drawn by the system: it lands wherever it likes and ignores the theme.
// This one is ours, anchored under its trigger and the width of it.
export function Select({ value, onValueChange, options, label, className = "" }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger title={label} aria-label={label} className={`${TRIGGER} ${className}`}>
        <RSelect.Value />
        <RSelect.Icon asChild>
          <ChevronDown size={15} className="ml-auto text-muted" />
        </RSelect.Icon>
      </RSelect.Trigger>

      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          align="start"
          sideOffset={6}
          className="z-[300] min-w-[var(--radix-select-trigger-width)] animate-pop-in overflow-hidden rounded-md border border-line bg-surface shadow-card"
        >
          <RSelect.Viewport className="max-h-72 p-1">
            {options.map((option) => (
              <RSelect.Item
                key={option.value}
                value={option.value}
                className="relative flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 pr-8 text-sm text-text outline-none transition-colors data-[highlighted]:bg-primary data-[highlighted]:text-primary-fg data-[state=checked]:font-semibold"
              >
                <RSelect.ItemText>{option.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="absolute right-2.5">
                  <Check size={15} />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
