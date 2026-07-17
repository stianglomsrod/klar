import { StudentShell } from "@/components/v3/StudentShell";

export default function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <StudentShell>{children}</StudentShell>;
}
