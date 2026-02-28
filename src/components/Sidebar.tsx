"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  Calendar,
  Home,
  Trophy,
  LogOut,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/utils/supabase/client";

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
  // Nye props for å matche footer:
  level?: number;
  progressPercent?: number;
  avatar?: string;
  /** Called when the student clicks their avatar to change it. */
  onAvatarClick?: () => void;
};

export default function Sidebar({
  isOpen: externalIsOpen,
  onClose,
  // Standardverdier som matcher StudentFooter:
  level = 3,
  progressPercent = 42,
  avatar = "🦄",
  onAvatarClick,
}: SidebarProps = {}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const handleClose = onClose || (() => setInternalIsOpen(false));
  const handleOpen = () => setInternalIsOpen(true);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const menuItems = [
    { name: "Dagen i dag", icon: Home, href: "/" },
    { name: "Fag & Oppgaver", icon: BookOpen, href: "/student/fag" },
    { name: "Timeplan", icon: Calendar, href: "/student/timeplan" },
    { name: "Belønninger", icon: Trophy, href: "/belonninger" },
  ];

  const safeProgress = Math.max(0, Math.min(100, progressPercent));

  return (
    <>
      {/* Hamburger Button - only show if using internal state */}
      {externalIsOpen === undefined && (
        <button
          onClick={handleOpen}
          className="fixed top-4 left-4 z-40 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 text-gray-800 transition-colors"
        >
          <Menu size={24} />
        </button>
      )}

      {/* Dark Overlay Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[300px] z-50 bg-white/95 backdrop-blur-md shadow-2xl"
          >
            {/* Header with Close Button */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-indigo-600">Klar</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Lukk meny"
              >
                <X size={24} className="text-gray-700" />
              </button>
            </div>

            {/* Navigation Menu Items */}
            <div className="py-4 px-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={handleClose}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-indigo-50 transition-colors text-gray-700 hover:text-indigo-700 group"
                  >
                    <Icon
                      size={20}
                      className="group-hover:scale-110 transition-transform"
                    />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}

              {/* Logout Button */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 group w-full"
                >
                  <LogOut
                    size={20}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="font-medium">Logg ut</span>
                </button>
              </div>
            </div>

            {/* Bottom Progress Card (Nå synkronisert med footer!) */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-xl text-center border border-indigo-100">
                <button
                  type="button"
                  onClick={onAvatarClick}
                  className="relative group mx-auto mb-1 cursor-pointer"
                  aria-label="Bytt avatar"
                >
                  {avatar && avatar.startsWith("http") ? (
                    <img
                      src={avatar}
                      alt="Avatar"
                      className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 group-hover:ring-2 group-hover:ring-indigo-400 transition-all"
                    />
                  ) : (
                    <span className="text-3xl block group-hover:scale-110 transition-transform">
                      {avatar}
                    </span>
                  )}
                  {/* Pencil overlay on hover */}
                  <span className="absolute -bottom-0.5 -right-0.5 bg-indigo-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    ✏️
                  </span>
                </button>
                <p className="text-sm text-gray-600 mt-1 font-semibold">
                  Nivå {level}
                </p>
                <div className="w-full bg-gray-200 h-2.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${safeProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
