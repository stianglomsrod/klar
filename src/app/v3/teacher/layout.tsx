import { StaffShell } from "@/components/v3/StaffShell";
import { getStaffShellContext } from "@/server/staff/staff-service";

export default async function TeacherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getStaffShellContext();
  return <StaffShell context={context}>{children}</StaffShell>;
}
