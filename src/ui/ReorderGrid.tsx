import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, type ReactNode } from "react";
import { moved } from "../lib/moved.ts";

type ReorderGridProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  onReorder: (keys: string[]) => void;
  className: string;
};

// A few pixels before a press becomes a drag, so a plain click still opens the anime.
const DRAG_AFTER_PX = 8;

function Sortable({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-grab ${isDragging ? "opacity-30" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function ReorderGrid<T>({
  items,
  keyOf,
  render,
  onReorder,
  className,
}: ReorderGridProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_AFTER_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [lifted, setLifted] = useState<string | null>(null);
  const keys = items.map(keyOf);
  const held = items.find((item) => keyOf(item) === lifted);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setLifted(String(active.id))}
      onDragCancel={() => setLifted(null)}
      onDragEnd={({ active, over }) => {
        setLifted(null);
        if (!over || active.id === over.id) return;
        const from = keys.indexOf(String(active.id));
        const to = keys.indexOf(String(over.id));
        if (from !== -1 && to !== -1) onReorder(moved(keys, from, to));
      }}
    >
      <SortableContext items={keys} strategy={rectSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <Sortable key={keyOf(item)} id={keyOf(item)}>
              {render(item)}
            </Sortable>
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {held && (
          <div className="rotate-2 scale-105 cursor-grabbing drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)]">
            {render(held)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
