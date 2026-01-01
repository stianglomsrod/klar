"use client";

import { usePathname } from "next/navigation";
import StudentFooterWrapper from "@/components/StudentFooterWrapper";
import Navigation from "@/components/Navigation";

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isTeacherRoute = pathname?.startsWith("/teacher");

  if (isTeacherRoute) {
    // Teacher routes: no student navigation or footer
    return <>{children}</>;
  }

  // Student routes: include navigation and footer with padding
  return (
    <div className="pt-16 pb-32">
      <Navigation />
      {children}
      <StudentFooterWrapper />
    </div>
  );
}
