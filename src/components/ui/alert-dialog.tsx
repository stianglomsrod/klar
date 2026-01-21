"use client";

import {
  useState,
  createContext,
  useContext,
  ReactNode,
  useRef,
  useEffect,
} from "react";
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
  undefined
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

export function AlertDialogContent({ children }: { children: ReactNode }) {
  const { open, setOpen, triggerPosition } = useAlertDialog();
  const contentRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (open && triggerPosition && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let { top, left } = triggerPosition;
      top = top - rect.height / 2;

      if (top < 16) top = 16;
      if (top + rect.height > viewportHeight - 16) {
        top = viewportHeight - rect.height - 16;
      }
      if (left + rect.width > viewportWidth - 16) {
        left = triggerPosition.left - rect.width - 24;
      }
      if (left < 16) left = 16;

      setAdjustedPosition({ top, left });
    }
  }, [open, triggerPosition]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30"
            style={{ zIndex: 9999 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, scale: 0.95, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: -10 }}
            transition={{ duration: 0.15 }}
            className="fixed w-80 bg-white rounded-lg shadow-xl p-5 border border-gray-200"
            style={{
              zIndex: 10000,
              top: adjustedPosition?.top ?? triggerPosition?.top ?? "50%",
              left: adjustedPosition?.left ?? triggerPosition?.left ?? "50%",
              transform:
                adjustedPosition || triggerPosition
                  ? undefined
                  : "translate(-50%, -50%)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute w-3 h-3 bg-white border-l border-t border-gray-200 -left-1.5 top-1/2 -translate-y-1/2 rotate-[-45deg]"
              style={{ zIndex: -1 }}
            />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
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
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "destructive";
}) {
  const { setOpen } = useAlertDialog();

  const baseStyles =
    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors";
  const variantStyles =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white";

  return (
    <button
      onClick={() => {
        onClick?.();
        setOpen(false);
      }}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
}
