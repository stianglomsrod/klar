import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FlowerGarden } from "@/components/v3/FlowerGarden";
import { getOwnFlowerRewards } from "@/server/rewards/flower-reward-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";

export default async function StudentRewardsPage() {
  const [experience, rewards] = await Promise.all([
    getOwnStudentExperience(),
    getOwnFlowerRewards(),
  ]);
  if (
    !experience.flowerRewardsAllowed ||
    !experience.flowerRewardsVisible ||
    !rewards.rewardsAllowed ||
    !rewards.rewardsVisible
  ) {
    redirect("/v3/student");
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-[calc(100dvh-4rem)] scroll-mt-20 bg-sky-50 px-4 pb-16 pt-7 text-slate-950 focus:outline-none sm:px-6 sm:pt-9"
    >
      <div className="mx-auto max-w-6xl">
        <Link
          href="/v3/student"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl font-bold text-indigo-800 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          Tilbake til dagen
        </Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-pink-700">
          Mine belønninger
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          Blomsterhagen
        </h1>
        <p className="mb-7 mt-3 max-w-2xl text-lg leading-7 text-slate-600 sm:mb-9">
          Velg farger til kronbladene du får når du når et nytt nivå for første
          gang.
        </p>
        <FlowerGarden initialProjection={rewards} />
      </div>
    </main>
  );
}
