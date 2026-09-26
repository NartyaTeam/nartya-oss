import { Select } from "../../ui/Select.tsx";
import { STATUSES, type Lists } from "./lists.ts";
import { useLists } from "./store.ts";

const REMOVE = "remove";

type StatusPickerProps = {
  api: Lists;
  anime: { slug: string; title: string; cover: string | null };
};

export function StatusPicker({ api, anime }: StatusPickerProps) {
  const known = useLists((state) => state.items !== null);
  const status = useLists(
    (state) => state.items?.find((entry) => entry.slug === anime.slug)?.status ?? null,
  );
  const failed = useLists((state) =>
    state.failed?.slug === anime.slug ? state.failed.message : null,
  );
  const place = useLists((state) => state.place);
  const remove = useLists((state) => state.remove);

  const options = [
    ...STATUSES.map((entry) => ({ value: entry.key, label: entry.label })),
    ...(status ? [{ value: REMOVE, label: "Retirer de ma liste" }] : []),
  ];

  const choose = (value: string): void => {
    if (value === REMOVE) {
      void remove(api, anime.slug);
      return;
    }
    const picked = STATUSES.find((entry) => entry.key === value)?.key;
    if (picked) void place(api, { ...anime, status: picked, changedAt: null });
  };

  return (
    <div className={`relative min-w-0 flex-1 ${known ? "" : "pointer-events-none opacity-40"}`}>
      <Select
        value={status ?? ""}
        onValueChange={choose}
        options={options}
        label="Ma liste"
        placeholder="Ajouter à ma liste"
        className="h-12 w-full"
      />
      {failed && <p className="absolute left-0 top-full mt-2 text-xs text-primary">{failed}</p>}
    </div>
  );
}
