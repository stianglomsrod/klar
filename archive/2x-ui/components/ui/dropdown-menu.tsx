"use client";

import * as React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

/* ─── Root ─── */
export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <Popover>{children}</Popover>;
}

/* ─── Trigger ─── */
export function DropdownMenuTrigger({
  children,
  asChild,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <PopoverTrigger asChild={asChild} className={className} onClick={onClick}>
      {children}
    </PopoverTrigger>
  );
}

/* ─── Content ─── */
export function DropdownMenuContent({
  children,
  align = "end",
  sideOffset = 4,
  className = "",
}: {
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  className?: string;
}) {
  return (
    <PopoverContent
      align={align}
      sideOffset={sideOffset}
      className={`w-44 p-1 rounded-lg shadow-lg border border-gray-200 bg-white ${className}`}
    >
      {children}
    </PopoverContent>
  );
}

/* ─── Item ─── */
export function DropdownMenuItem({
  children,
  onClick,
  className = "",
  destructive = false,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-100"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Separator ─── */
export function DropdownMenuSeparator({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`my-1 h-px bg-gray-200 ${className}`} />;
}
