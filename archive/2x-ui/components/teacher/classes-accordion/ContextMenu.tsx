"use client";

import type { OpenMenu, Student } from "./types";
import StudentContextMenu from "@/components/shared/StudentContextMenu";

type ContextMenuProps = {
  openMenu: NonNullable<OpenMenu>;
  onAction: (action: string, id: string, student?: Student) => void;
};

export default function ContextMenu({ openMenu, onAction }: ContextMenuProps) {
  if (openMenu.type === "student") {
    return (
      <StudentContextMenu
        position={openMenu.position}
        items={[
          { label: "Se profil", action: "view-profile" },
          { label: "Rediger", action: "edit-student" },
          { label: "Flytt elev", action: "move-student" },
          { divider: true },
          { label: "Fjern elev", action: "remove-student", variant: "danger" },
        ]}
        onAction={(action) => onAction(action, openMenu.id, openMenu.student)}
      />
    );
  }

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]"
      style={{ top: openMenu.position.y, left: openMenu.position.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {openMenu.type === "trinn" && (
        <>
          <button
            onClick={() => onAction("add-class", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Legg til klasse
          </button>
          <button
            onClick={() => onAction("edit-trinn", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Rediger trinn
          </button>
        </>
      )}

      {openMenu.type === "class" && (
        <>
          <button
            onClick={() => onAction("add-student", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Legg til elev
          </button>
          <button
            onClick={() => onAction("message-class", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Send melding til klasse
          </button>
          <button
            onClick={() => onAction("edit-class", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Rediger klassenavn
          </button>
          <div className="border-t border-slate-200 my-1" />
          <button
            onClick={() => onAction("delete-class", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Slett klasse
          </button>
        </>
      )}
    </div>
  );
}
