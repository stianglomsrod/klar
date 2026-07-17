import {
  FLOWER_REWARD_PRESENTATION,
  type FlowerRewardClaim,
} from "@/lib/flower-rewards";

const PETALS = [0, 72, 144, 216, 288] as const;

export function StudentFlower({
  flowerNumber,
  claims,
  className = "h-auto w-full",
}: {
  flowerNumber: number;
  claims: FlowerRewardClaim[];
  className?: string;
}) {
  const byPetal = new Map(claims.map((claim) => [claim.petalNumber, claim]));
  const count = byPetal.size;
  const label = `Blomst ${flowerNumber}, ${count} av 5 kronblader valgt`;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 138"
      className={className}
    >
      <path
        d="M50 68v58"
        fill="none"
        stroke="#3f7d45"
        strokeLinecap="round"
        strokeWidth="6"
      />
      <path d="M48 101C32 91 24 96 22 111c12 2 21-1 28-10Z" fill="#78ad6d" />
      <path d="M52 112c13-12 24-9 27 4-10 5-19 3-27-4Z" fill="#5f985d" />
      {PETALS.map((rotation, index) => {
        const petalNumber = index + 1;
        const claim = byPetal.get(petalNumber);
        return (
          <ellipse
            key={petalNumber}
            aria-hidden="true"
            cx="50"
            cy="25"
            rx="14"
            ry="24"
            transform={`rotate(${rotation} 50 50)`}
            fill={
              claim
                ? FLOWER_REWARD_PRESENTATION[claim.flowerColor].color
                : "#e2e8f0"
            }
            stroke={claim ? "#ffffff" : "#94a3b8"}
            strokeDasharray={claim ? undefined : "4 4"}
            strokeWidth="2.5"
          />
        );
      })}
      <circle
        aria-hidden="true"
        cx="50"
        cy="50"
        r="13"
        fill="#f2c94c"
        stroke="#ffffff"
        strokeWidth="3"
      />
    </svg>
  );
}
