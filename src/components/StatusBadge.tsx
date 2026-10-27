import type { MatchStatus } from "@/lib/db.types";

const styles: Record<MatchStatus, string> = {
  live: "bg-red-600 text-white",
  scheduled: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  finished: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
};

const text: Record<MatchStatus, string> = { live: "Live", scheduled: "Upcoming", finished: "Finished" };

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
      {text[status]}
    </span>
  );
}
