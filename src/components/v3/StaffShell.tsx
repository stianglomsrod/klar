"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { signOutPrototypeAction } from "@/app/actions/v3/auth-actions";
import type { StaffShellContext } from "@/server/staff/staff-service";
import { restoreDialogFocus, trapDialogFocus } from "./dialog-focus";

function Navigation({
  context,
  pathname,
  onNavigate,
}: {
  context: StaffShellContext;
  pathname: string;
  onNavigate?: () => void;
}) {
  const links = [
    { href: "/v3/teacher", label: "Oversikt", icon: LayoutDashboard },
    ...(context.isOwner
      ? [{ href: "/v3/teacher/access", label: "Tilganger", icon: ShieldCheck }]
      : []),
  ];

  return (
    <nav aria-label="Ansattnavigasjon" className="flex flex-col gap-2">
      {links.map((link) => {
        const active =
          link.href === "/v3/teacher"
            ? pathname === link.href || pathname.startsWith("/v3/teacher/classes/")
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
              active
                ? "bg-indigo-50 text-indigo-800"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon aria-hidden="true" size={20} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ context }: { context: StaffShellContext }) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <p className="truncate font-semibold">{context.displayName}</p>
      <p className="mt-1 truncate text-xs text-slate-500">
        {context.isOwner ? "Eier" : "Ansatt"} · {context.organizationName}
      </p>
      <form action={signOutPrototypeAction} className="mt-3">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <LogOut aria-hidden="true" size={20} />
          Logg ut
        </button>
      </form>
    </div>
  );
}

export function StaffShell({
  context,
  children,
}: {
  context: StaffShellContext;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const desktopSidebar = useRef<HTMLElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const mobileHeader = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigationFocusRegion = useRef<"desktop" | "mobile" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function closeDrawer() {
    drawer.current?.close();
    setDrawerOpen(false);
  }

  function openDrawer() {
    drawer.current?.showModal();
    setDrawerOpen(true);
  }

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const trackNavigationFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target === document.body || target === document.documentElement) return;

      if (desktopSidebar.current?.contains(target)) {
        navigationFocusRegion.current = "desktop";
      } else if (
        mobileHeader.current?.contains(target) ||
        drawer.current?.contains(target)
      ) {
        navigationFocusRegion.current = "mobile";
      } else {
        navigationFocusRegion.current = null;
      }
    };
    const focusAfterLayout = (resolveDestination: () => HTMLElement | null) => {
      requestAnimationFrame(() => {
        const destination = resolveDestination();
        if (destination?.isConnected && destination.getClientRects().length > 0) {
          destination.focus({ preventScroll: true });
        }
      });
    };
    const preserveNavigationFocus = () => {
      const previousRegion = navigationFocusRegion.current;
      if (media.matches) {
        drawer.current?.close();
        setDrawerOpen(false);
        if (previousRegion === "mobile") {
          focusAfterLayout(
            () =>
              desktopSidebar.current?.querySelector<HTMLElement>(
                'a[aria-current="page"]',
              ) ??
              desktopSidebar.current?.querySelector<HTMLElement>("a[href]") ??
              null,
          );
        }
      } else if (previousRegion === "desktop") {
        focusAfterLayout(() => menuButton.current);
      }
    };
    document.addEventListener("focusin", trackNavigationFocus);
    media.addEventListener("change", preserveNavigationFocus);
    return () => {
      document.removeEventListener("focusin", trackNavigationFocus);
      media.removeEventListener("change", preserveNavigationFocus);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside
        ref={desktopSidebar}
        className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white p-5 lg:flex"
      >
        <Link
          href="/v3/teacher"
          className="flex min-h-11 items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-700 font-bold text-white" aria-hidden="true">
            K
          </span>
          <span>
            <span className="block text-lg font-bold">Klar</span>
            <span className="block text-xs text-slate-500">Ansattflate</span>
          </span>
        </Link>
        <div className="mt-8">
          <Navigation context={context} pathname={pathname} />
        </div>
        <div className="mt-auto">
          <Account context={context} />
        </div>
      </aside>

      <div className="min-w-0">
        <header
          ref={mobileHeader}
          className="staff-mobile-header sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 lg:hidden"
        >
          <button
            ref={menuButton}
            type="button"
            onClick={openDrawer}
            aria-label="Åpne meny"
            aria-expanded={drawerOpen}
            aria-controls="staff-navigation-drawer"
            className="grid min-h-11 min-w-11 place-items-center rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <Menu aria-hidden="true" />
          </button>
          <Link href="/v3/teacher" className="flex min-h-11 items-center gap-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-700 font-bold text-white" aria-hidden="true">K</span>
            <span className="font-bold">Klar</span>
          </Link>
        </header>

        <div className="staff-shell-content mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          {children}
        </div>
      </div>

      <dialog
        ref={drawer}
        id="staff-navigation-drawer"
        className="staff-drawer m-0 h-dvh max-h-none w-[min(21rem,88vw)] max-w-none bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
        aria-label="Meny"
        onClose={() => {
          setDrawerOpen(false);
          if (!window.matchMedia("(min-width: 1024px)").matches) {
            restoreDialogFocus(menuButton.current);
          }
        }}
        onKeyDown={trapDialogFocus}
      >
        <div className="staff-drawer__content flex h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-bold">Meny</p>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Lukk meny"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6">
            <Navigation
              context={context}
              pathname={pathname}
              onNavigate={closeDrawer}
            />
          </div>
          <div className="mt-auto">
            <Account context={context} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
