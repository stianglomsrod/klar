"use client";

import { useState, createContext, useContext, ReactNode, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

type Position = { top: number; left: number } | null;

type AlertDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerPosition: Position;
  setTriggerPosition: (pos: Position) => void;
};

const AlertDialogContext = createContext<AlertDialogContextType | undefined>(
  undefined,
);

function useAlertDialog() {
  const context = useContext(AlertDialogContext);
  if (!context) {
    throw new Error("AlertDialog components must be used within AlertDialog");
  }
  return context;
}

type AlertDialogProps = {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AlertDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [triggerPosition, setTriggerPosition] = useState<Position>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (val: boolean) => onOpenChange?.(val)
    : setUncontrolledOpen;

  return (
    <AlertDialogContext.Provider
      value={{ open, setOpen, triggerPosition, setTriggerPosition }}
    >
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({
  children,
  asChild,
}: {
  children: ReactNode;
  asChild?: boolean;
}) {
  const { setOpen, setTriggerPosition } = useAlertDialog();
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTriggerPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
    }
    setOpen(true);
  };

  if (asChild) {
    return (
      <span ref={triggerRef} onClick={handleClick}>
        {children}
      </span>
    );
  }

  return (
    <span ref={triggerRef}>
      <button onClick={handleClick}>{children}</button>
    </span>
  );
}

export function AlertDialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useAlertDialog();

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 9999 }}
            onClick={() => setOpen(false)}
          />
          {/* Centered dialog box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`fixed left-[50%] top-[50%] z-[10000] w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-white rounded-lg shadow-xl p-6 border border-gray-200 ${className ?? ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function AlertDialogHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
}

export function AlertDialogFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex justify-end gap-2 mt-4 ${className}`}>{children}</div>
  );
}

export function AlertDialogTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-base font-semibold text-slate-900 ${className}`}>
      {children}
    </h2>
  );
}

export function AlertDialogDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-sm text-slate-600 ${className}`}>{children}</p>;
}

export function AlertDialogCancel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { setOpen } = useAlertDialog();

  return (
    <button
      onClick={() => setOpen(false)}
      className={`px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({
  children,
  onClick,
  className = "",
  variant = "default",
  disabled = false,
  autoClose = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  autoClose?: boolean;
}) {
  const { setOpen } = useAlertDialog();

  const baseStyles =
    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variantStyles =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white";

  return (
    <button
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
        if (autoClose) setOpen(false);
      }}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
}
