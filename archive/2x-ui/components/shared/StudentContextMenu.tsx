"use client";

export type MenuEntry =
  | { label: string; action: string; variant?: "danger" }
  | { divider: true };

type StudentContextMenuProps = {
  position: { x: number; y: number };
  items: MenuEntry[];
  onAction: (action: string) => void;
};

export default function StudentContextMenu({
  position,
  items,
  onAction,
}: StudentContextMenuProps) {
  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        "divider" in item ? (
          <div key={`d-${i}`} className="border-t border-slate-200 my-1" />
        ) : (
          <button
            key={item.action}
            onClick={() => onAction(item.action)}
            className={`w-full px-4 py-2 text-left text-sm transition-colors ${
              item.variant === "danger"
                ? "text-red-600 hover:bg-red-50"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
