import type { Metadata } from "next";
import TeacherLayoutShell from "@/components/teacher/TeacherLayoutShell";

export const metadata: Metadata = {
  title: "Klar - Lærer Dashboard",
  description: "Lærer dashboard for Klar",
};

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherLayoutShell>{children}</TeacherLayoutShell>;
}
