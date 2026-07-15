import { MfaPanel } from "@/components/v3/MfaPanel";

export default function MfaEnrollmentPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-950 focus:outline-none">
      <MfaPanel mode="enroll" />
    </main>
  );
}
