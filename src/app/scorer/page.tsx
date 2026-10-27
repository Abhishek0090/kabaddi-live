import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/CopyLink";
import { SignOutButton } from "@/components/SignOutButton";
import { StatusBadge } from "@/components/StatusBadge";
import { btn, card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { CreateRoomForm } from "./CreateRoomForm";

export const metadata: Metadata = { title: "My rooms", robots: { index: false } };

const smallBtn =
  "inline-flex min-h-11 items-center rounded-lg border-2 border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function AdminHome() {
  const { supabase, userId, email } = await requireAdmin("/scorer");
  const { data: rooms, error } = await supabase
    .from("matches")
    .select("id, team_a, team_b, scheduled_at, status, state")
    .eq("scorer_id", userId)
    .order("scheduled_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">My rooms</h1>
          <p className="text-sm text-zinc-500">{email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={btn.secondary}>
            Public site
          </Link>
          <SignOutButton className={btn.secondary} />
        </div>
      </header>

      <CreateRoomForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Your match rooms</h2>
        {error && <p className="font-semibold text-red-600">Could not load rooms: {error.message}</p>}
        {rooms?.length === 0 && <p className="text-zinc-500">No rooms yet. Create one above.</p>}
        {rooms?.map((room) => (
          <article key={room.id} className={`${card} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">
                {room.team_a} <span className="tabular-nums">{room.state.teams.A.score}</span>
                <span className="mx-2 text-zinc-400">-</span>
                <span className="tabular-nums">{room.state.teams.B.score}</span> {room.team_b}
              </h3>
              <StatusBadge status={room.status} />
            </div>
            <p className="text-sm text-zinc-500">{formatDateTime(room.scheduled_at)}</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/scorer/${room.id}`} className={btn.primary}>
                Open control panel
              </Link>
              <Link href={`/match/${room.id}`} className={smallBtn} target="_blank">
                Scoreboard
              </Link>
              <CopyLink path={`/match/${room.id}`} label="Copy scoreboard link" className={smallBtn} />
              <CopyLink path={`/overlay/${room.id}`} label="Copy OBS overlay link" className={smallBtn} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
