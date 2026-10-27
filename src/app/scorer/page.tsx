import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/CopyLink";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { StatusBadge } from "@/components/StatusBadge";
import { btn, card } from "@/components/ui";
import { listMyRooms } from "@/lib/adminData";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { MOCK } from "@/lib/mode";
import { CreateRoomForm } from "./CreateRoomForm";

export const metadata: Metadata = { title: "My rooms", robots: { index: false } };

const smallBtn =
  "inline-flex min-h-11 items-center rounded-lg border-2 border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default async function AdminHome() {
  const { userId, email } = await requireAdmin("/scorer");
  const rooms = await listMyRooms(userId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-zinc-500 sm:inline">{email}</span>
          <Link href="/" className={smallBtn}>
            Public site
          </Link>
          <SignOutButton className={smallBtn} />
        </div>
      </header>

      <div>
        <h1 className="text-3xl font-black tracking-tight">My rooms</h1>
        {MOCK && <p className="text-sm text-amber-600 dark:text-amber-400">Demo mode: rooms live in memory until the server restarts.</p>}
      </div>

      <CreateRoomForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Your match rooms</h2>
        {rooms.length === 0 && <p className="text-zinc-500">No rooms yet. Create one above.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((room) => (
            <article key={room.id} className={`${card} flex flex-col gap-3`}>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={room.status} />
                <span className="text-sm text-zinc-500">{formatDateTime(room.scheduled_at)}</span>
              </div>
              <h3 className="text-lg font-black">
                <span className="text-orange-600 dark:text-orange-400">{room.team_a}</span>{" "}
                <span className="tabular-nums">{room.state.teams.A.score}</span>
                <span className="mx-2 text-zinc-400">-</span>
                <span className="tabular-nums">{room.state.teams.B.score}</span>{" "}
                <span className="text-sky-600 dark:text-sky-400">{room.team_b}</span>
              </h3>
              <Link href={`/scorer/${room.id}`} className={btn.primary}>
                Open control panel
              </Link>
              <div className="flex flex-wrap gap-2">
                <Link href={`/match/${room.id}`} className={smallBtn} target="_blank">
                  Scoreboard
                </Link>
                <CopyLink path={`/match/${room.id}`} label="Copy scoreboard link" className={smallBtn} />
                <CopyLink path={`/overlay/${room.id}`} label="Copy OBS link" className={smallBtn} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
