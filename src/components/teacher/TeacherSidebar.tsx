"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Gift,
  MessageSquare,
  CalendarDays,
  Mail,
  LogOut,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
    href: "/teacher/tasks",
    icon: BookOpen,
  },
  {
    name: "Timeplaner",
    href: "/teacher/timeplan",
    icon: CalendarDays,
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
  {
    name: "Ukebrev",
    href: "/teacher/ukebrev",
    icon: Mail,
  },
];

type TeacherSidebarProps = {
  onNavigate?: () => void;
};

export default function TeacherSidebar({ onNavigate }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isActive = (href: string) => {
    if (href === "/teacher") {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="flex flex-col h-full space-y-1">
      <div className="space-y-1">
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
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-slate-700 hover:bg-slate-100 w-full"
        >
          <LogOut className="h-5 w-5" />
          <span>Logg ut</span>
        </button>
      </div>
    </nav>
  );
}
