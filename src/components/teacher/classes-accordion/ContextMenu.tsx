"use client";

import type { OpenMenu, Student } from "./types";

type ContextMenuProps = {
  openMenu: NonNullable<OpenMenu>;
  onAction: (action: string, id: string, student?: Student) => void;
};

export default function ContextMenu({ openMenu, onAction }: ContextMenuProps) {
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

      {openMenu.type === "student" && (
        <>
          <button
            onClick={() => onAction("view-profile", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Se profil
          </button>
          <button
            onClick={() =>
              onAction("edit-student", openMenu.id, openMenu.student)
            }
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Rediger
          </button>
          <button
            onClick={() => onAction("move-student", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Flytt elev
          </button>
          <div className="border-t border-slate-200 my-1" />
          <button
            onClick={() => onAction("remove-student", openMenu.id)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Fjern elev
          </button>
        </>
      )}
    </div>
  );
}
