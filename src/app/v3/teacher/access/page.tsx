import { notFound } from "next/navigation";
import { StaffAccessManager } from "@/components/v3/StaffAccessManager";
import { isAuthorizationError } from "@/server/auth/errors";
import { getStaffAccessManagement } from "@/server/staff/staff-service";

export default async function StaffAccessPage() {
  const management = await getStaffAccessManagement().catch((error: unknown) => {
    if (isAuthorizationError(error)) notFound();
    throw error;
  });

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <StaffAccessManager
        management={management}
        initialNow={new Date().toISOString()}
      />
    </main>
  );
}
