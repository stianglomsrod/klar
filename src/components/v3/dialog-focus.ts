import type { KeyboardEvent } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      element.getAttribute("aria-hidden") !== "true",
  );
  if (focusable.length === 0) {
    event.preventDefault();
    event.currentTarget.focus();
    return;
  }

  const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
  const leavingBackwards = event.shiftKey && activeIndex <= 0;
  const leavingForwards = !event.shiftKey && activeIndex === focusable.length - 1;
  const focusWasOutside = activeIndex === -1;
  if (!leavingBackwards && !leavingForwards && !focusWasOutside) return;

  event.preventDefault();
  const destination = event.shiftKey ? focusable.at(-1) : focusable[0];
  destination?.focus();
}

export function restoreDialogFocus(element: HTMLElement | null) {
  requestAnimationFrame(() => {
    if (element?.isConnected) element.focus();
  });
}
