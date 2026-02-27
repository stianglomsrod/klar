"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export type ConfirmDialogState = {
  title: string;
  description: string;
  action: () => void;
} | null;

type ConfirmDialogProps = {
  state: ConfirmDialogState;
  onClose: () => void;
  /** Label for the confirm button. Defaults to "Bekreft" */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Avbryt" */
  cancelLabel?: string;
  /** Tailwind classes for the confirm button */
  confirmClassName?: string;
};

export default function ConfirmDialog({
  state,
  onClose,
  confirmLabel = "Bekreft",
  cancelLabel = "Avbryt",
  confirmClassName = "bg-red-600 text-white hover:bg-red-700",
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title ?? ""}</AlertDialogTitle>
          <AlertDialogDescription>
            {state?.description ?? ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={confirmClassName}
            onClick={() => {
              state?.action();
              onClose();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
