import { StudentShell } from "@/components/v3/StudentShell";
import { getOwnFlowerRewards } from "@/server/rewards/flower-reward-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [experience, rewards] = await Promise.all([
    getOwnStudentExperience(),
    getOwnFlowerRewards(),
  ]);
  const flowerGardenVisible =
    experience.flowerRewardsAllowed &&
    experience.flowerRewardsVisible &&
    rewards.rewardsAllowed &&
    rewards.rewardsVisible;

  return (
    <StudentShell
      flowerGardenVisible={flowerGardenVisible}
      pendingFlowerRewards={
        flowerGardenVisible ? rewards.availableEntitlements.length : 0
      }
    >
      {children}
    </StudentShell>
  );
}
