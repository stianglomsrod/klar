import { MfaPanel } from "@/components/v3/MfaPanel";

export default function MfaChallengePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-950">
      <MfaPanel mode="challenge" />
    </main>
  );
}
