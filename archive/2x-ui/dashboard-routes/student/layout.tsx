import type { Metadata } from "next";
import StudentLayoutShell from "@/components/student/StudentLayoutShell";

export const metadata: Metadata = {
  title: "Klar - Elev",
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StudentLayoutShell>{children}</StudentLayoutShell>;
}
