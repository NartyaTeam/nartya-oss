import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type Option = { value: string; label: string; icon?: ReactNode; group?: string };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  label: string;
  placeholder?: string;
  className?: string;
};

const TRIGGER =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-surface pl-3.5 pr-3 text-sm font-medium text-text outline-none ring-1 ring-line transition-colors hover:bg-surface-2 focus:ring-primary/60 data-[state=open]:ring-primary/60";

type Run = { group: string | undefined; options: Option[] };

function runsOf(options: Option[]): Run[] {
  const runs: Run[] = [];
  for (const option of options) {
    const last = runs.at(-1);
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}

// The native menu is drawn by the system: it lands wherever it likes and ignores the theme.
// This one is ours, anchored under its trigger and the width of it.
export function Select(props: SelectProps) {
  const { value, onValueChange, options, label, placeholder, className = "" } = props;
  return (
    <RSelect.Root value={value} onValueChange={onValueChange}>
      <RSelect.Trigger title={label} aria-label={label} className={`${TRIGGER} ${className}`}>
        <RSelect.Value placeholder={placeholder} />
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
            {runsOf(options).map((run, i) => (
              <RSelect.Group
                key={`${run.group ?? ""}${String(i)}`}
                className="border-line/60 [&:not(:first-child)]:mt-1 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-1"
              >
                {run.group && (
                  <RSelect.Label className="cursor-default select-none px-2.5 pb-1 pt-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted/60">
                    {run.group}
                  </RSelect.Label>
                )}
                {run.options.map((option) => (
                  <RSelect.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 pr-8 text-sm text-text outline-none transition-colors data-[highlighted]:bg-primary data-[highlighted]:text-primary-fg data-[state=checked]:font-semibold"
                  >
                    <RSelect.ItemText>
                      <span className="inline-flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </span>
                    </RSelect.ItemText>
                    <RSelect.ItemIndicator className="absolute right-2.5">
                      <Check size={15} />
                    </RSelect.ItemIndicator>
                  </RSelect.Item>
                ))}
              </RSelect.Group>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
