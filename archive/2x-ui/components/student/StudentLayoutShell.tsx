"use client";

import Navigation from "@/components/Navigation";
import StudentFooterWrapper from "@/components/StudentFooterWrapper";
import { StudentProfileProvider } from "@/contexts/StudentProfileContext";

export default function StudentLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentProfileProvider>
      <div className="flex flex-col min-h-screen">
        <Navigation />
        <main className="flex-1 pt-16">{children}</main>
        <StudentFooterWrapper />
      </div>
    </StudentProfileProvider>
  );
}
