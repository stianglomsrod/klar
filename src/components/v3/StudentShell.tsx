"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, House, LogOut, Menu, X } from "lucide-react";
import { signOutPrototypeAction } from "@/app/actions/v3/auth-actions";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";

const links = [
  { href: "/v3/student", label: "Dagen i dag", icon: House },
  {
    href: "/v3/student/subjects",
    label: "Fag og oppgaver",
    icon: BookOpen,
  },
] as const;

function StudentNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav aria-label="Elevmeny" className="flex flex-col gap-2">
      {links.map((link) => {
        const active =
          link.href === "/v3/student"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => onNavigate(link.href)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 ${
              active
                ? "bg-indigo-50 text-indigo-900"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon aria-hidden="true" className="h-6 w-6" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigatingRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function openDrawer() {
    drawerRef.current?.showModal();
    setDrawerOpen(true);
  }

  function closeDrawer() {
    drawerRef.current?.close();
  }

  function navigateFromDrawer(href: string) {
    navigatingRef.current = href !== pathname;
    closeDrawer();
  }

  useEffect(() => {
    if (drawerRef.current?.open) drawerRef.current.close();
    if (!navigatingRef.current) return;
    navigatingRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-sky-50 text-slate-950">
      <header className="student-mobile-header sticky top-0 z-40 grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={openDrawer}
          aria-label="Åpne meny"
          aria-expanded={drawerOpen}
          aria-controls="student-navigation-drawer"
          className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>
        <Link
          href="/v3/student"
          className="justify-self-center rounded-lg px-3 py-2 font-black tracking-wide text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        >
          Klar
        </Link>
        <span aria-hidden="true" />
      </header>

      {children}

      <dialog
        ref={drawerRef}
        id="student-navigation-drawer"
        aria-label="Meny"
        className="student-drawer m-0 h-dvh max-h-none w-[min(21rem,88vw)] max-w-none bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClose={() => {
          setDrawerOpen(false);
          if (!navigatingRef.current) {
            restoreDialogFocus(menuButtonRef.current);
          }
        }}
        onKeyDown={trapDialogFocus}
      >
        <div className="student-drawer__content flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex min-h-12 items-center justify-between gap-4">
            <p className="text-xl font-black">Meny</p>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Lukk meny"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
            >
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-7">
            <StudentNavigation
              pathname={pathname}
              onNavigate={navigateFromDrawer}
            />
          </div>

          <form
            action={signOutPrototypeAction}
            className="mt-auto border-t border-slate-200 pt-4"
          >
            <button
              type="submit"
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
            >
              <LogOut aria-hidden="true" className="h-6 w-6" />
              Logg ut
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}
