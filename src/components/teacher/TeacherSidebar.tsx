"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Gift,
  MessageSquare,
} from "lucide-react";

const navigationItems = [
  {
    name: "Oversikt",
    href: "/teacher",
    icon: LayoutDashboard,
  },
  {
    name: "Mine Klasser",
    href: "/teacher/classes",
    icon: Users,
  },
  {
    name: "Fag & Oppgaver",
    href: "/teacher/subjects",
    icon: BookOpen,
  },
  {
    name: "Belønninger",
    href: "/teacher/rewards",
    icon: Gift,
  },
  {
    name: "Meldinger",
    href: "/teacher/messages",
    icon: MessageSquare,
  },
];

type TeacherSidebarProps = {
  onNavigate?: () => void;
};

export default function TeacherSidebar({ onNavigate }: TeacherSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/teacher") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="space-y-1">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              active
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-indigo-600" : ""}`} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
