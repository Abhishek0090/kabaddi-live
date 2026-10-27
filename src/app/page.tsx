import Link from "next/link";
import { connection } from "next/server";
import { StatusBadge } from "@/components/StatusBadge";
import { card, teamText } from "@/components/ui";
import type { MatchRow } from "@/lib/db.types";
import { formatDateTime } from "@/lib/format";
import { listMatches } from "@/lib/matches";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function Home() {
  await connection(); // always per request, even when built without Supabase env vars
  if (!hasSupabaseEnv()) return <SetupNeeded />;
  const { live, upcoming, finished } = await listMatches();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black sm:text-4xl">Kabaddi Live Score</h1>
        <Link
          href="/scorer"
          className="inline-flex min-h-11 items-center rounded-xl border-2 border-zinc-300 px-4 font-bold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Admin
        </Link>
      </header>

      <MatchList title="Live now" matches={live} empty="No matches live right now." />
      <MatchList title="Upcoming" matches={upcoming} empty="No upcoming matches." />
      <MatchList title="Finished" matches={finished} empty="No finished matches yet." />
    </main>
  );
}

function SetupNeeded() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-3xl font-black">Kabaddi Live Score</h1>
      <div className={`${card} flex flex-col gap-3`}>
        <h2 className="text-xl font-black">Connect Supabase to start</h2>
        <ol className="list-decimal space-y-2 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>Create a free project at supabase.com.</li>
          <li>
            In its SQL Editor, run <code className="font-mono">supabase/schema.sql</code>.
          </li>
          <li>
            Create <code className="font-mono">.env.local</code> in the project folder with{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (Project Settings &gt; API Keys).
          </li>
          <li>
            Restart <code className="font-mono">npm run dev</code>.
          </li>
        </ol>
        <p className="text-sm text-zinc-500">Full steps are in README.md.</p>
      </div>
    </main>
  );
}

function MatchList({ title, matches, empty }: { title: string; matches: MatchRow[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-black">{title}</h2>
      {matches.length === 0 && <p className="text-zinc-500">{empty}</p>}
      {matches.map((m) => (
        <Link key={m.id} href={`/match/${m.id}`} className={`${card} flex flex-col gap-2 hover:border-zinc-400 dark:hover:border-zinc-600`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-zinc-500">{formatDateTime(m.scheduled_at)}</span>
            <StatusBadge status={m.status} />
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xl font-black sm:text-2xl">
            <span className={`truncate ${teamText.A}`}>{m.team_a}</span>
            <span className="tabular-nums">
              {m.state.teams.A.score} - {m.state.teams.B.score}
            </span>
            <span className={`truncate text-right ${teamText.B}`}>{m.team_b}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
