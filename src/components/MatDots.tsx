import type { Team } from "@/lib/kabaddi.types";

const filled = { A: "bg-orange-500", B: "bg-sky-500" } as const;

/** One dot per player slot: filled when on the mat, hollow when out. */
export function MatDots({
  team,
  onMat,
  total,
  className = "h-3 w-3",
}: {
  team: Team;
  onMat: number;
  total: number;
  className?: string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-[0.35em]" role="img" aria-label={`${onMat} of ${total} on the mat`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${className} ${
            i < onMat ? filled[team] : "border-2 border-zinc-400 bg-transparent dark:border-zinc-600"
          }`}
        />
      ))}
    </div>
  );
}
