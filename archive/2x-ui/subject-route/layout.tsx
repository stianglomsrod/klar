"use client";

import Navigation from "@/components/Navigation";
import StudentFooterWrapper from "@/components/StudentFooterWrapper";
import { StudentProfileProvider } from "@/contexts/StudentProfileContext";

export default function SubjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentProfileProvider>
      <div className="min-h-screen">
        <Navigation />
        <div className="pt-16 pb-24">{children}</div>
        <StudentFooterWrapper />
      </div>
    </StudentProfileProvider>
  );
}
