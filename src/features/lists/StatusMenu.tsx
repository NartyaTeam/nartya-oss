import * as Menu from "@radix-ui/react-context-menu";
import { Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { STATUSES, type Status } from "./lists.ts";

type StatusMenuProps = {
  status: Status;
  onStatus: (status: Status) => void;
  onRemove: () => void;
  children: ReactNode;
};

const ITEM =
  "relative flex cursor-pointer select-none items-center gap-2.5 rounded px-2.5 py-2 pr-8 text-sm outline-none transition-colors data-[highlighted]:bg-primary data-[highlighted]:text-primary-fg";

export function StatusMenu({ status, onStatus, onRemove, children }: StatusMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <div>{children}</div>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="z-[300] min-w-48 animate-pop-in overflow-hidden rounded-md border border-line bg-surface p-1 shadow-card">
          <Menu.Label className="px-2.5 pb-1 pt-1.5 text-[0.65rem] font-medium uppercase tracking-wider text-muted/60">
            Statut
          </Menu.Label>
          {STATUSES.map((entry) => (
            <Menu.Item
              key={entry.key}
              onSelect={() => onStatus(entry.key)}
              className={`${ITEM} ${entry.key === status ? "font-semibold text-text" : "text-text"}`}
            >
              {entry.label}
              {entry.key === status && <Check size={15} className="absolute right-2.5" />}
            </Menu.Item>
          ))}
          <Menu.Separator className="my-1 h-px bg-line/60" />
          <Menu.Item onSelect={onRemove} className={`${ITEM} text-primary`}>
            <Trash2 size={14} />
            Retirer de ma liste
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
