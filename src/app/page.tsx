import Link from "next/link";
import { connection } from "next/server";
import { FeaturedMatch } from "@/components/FeaturedMatch";
import { Logo } from "@/components/Logo";
import { MatchCard } from "@/components/MatchCard";
import { SiteHeader } from "@/components/SiteHeader";
import type { MatchRow } from "@/lib/db.types";
import { listMatches, type MatchLists } from "@/lib/matches";
import { MOCK } from "@/lib/mode";

export default async function Home() {
  await connection(); // always per request, even when built without Supabase env vars
  const lists = await listMatches();
  const featured = lists ? (lists.live[0] ?? lists.upcoming[0] ?? lists.finished[0] ?? null) : null;

  return (
    <main className="flex flex-1 flex-col">
      <Hero featured={featured} liveCount={lists?.live.length ?? 0} />
      <div id="matches" className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14">
        {lists ? <MatchSections lists={lists} /> : <SetupNeeded />}
        <HowItWorks />
      </div>
      <Footer />
    </main>
  );
}

function Hero({ featured, liveCount }: { featured: MatchRow | null; liveCount: number }) {
  const watchHref = featured ? `/match/${featured.id}` : "#matches";
  return (
    <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
      {/* Glow in the two team colours */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_15%_10%,rgba(234,88,12,0.35),transparent),radial-gradient(50%_50%_at_90%_90%,rgba(14,165,233,0.25),transparent)]"
      />
      <CourtLines />
      <SiteHeader />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-14">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-zinc-200">
            <span className={`h-2 w-2 rounded-full ${liveCount > 0 ? "animate-pulse bg-red-500" : "bg-zinc-500"}`} />
            {liveCount > 0 ? `${liveCount} ${liveCount === 1 ? "match" : "matches"} live now` : "No match live right now"}
          </span>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Every raid.
            <br />
            Every point.
            <br />
            <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Live.</span>
          </h1>
          <p className="max-w-xl text-lg text-zinc-300 sm:text-xl">
            One scorer taps on a tablet at the mat. Fans follow on their phones and your stream shows it on screen, all
            within about a second.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={watchHref}
              className="inline-flex min-h-14 items-center rounded-xl bg-orange-600 px-6 text-lg font-bold text-white shadow-lg shadow-orange-600/30 transition hover:bg-orange-500"
            >
              {featured?.status === "live" ? "Watch live" : "See matches"}
            </Link>
            <Link
              href="/scorer"
              className="inline-flex min-h-14 items-center rounded-xl border border-white/20 bg-white/5 px-6 text-lg font-bold text-white transition hover:bg-white/10"
            >
              Score a match
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-zinc-400">
            <li>Updates in about 1 second</li>
            <li>Keeps scoring offline</li>
            <li>OBS overlay included</li>
          </ul>
        </div>

        <div className="w-full max-w-lg justify-self-center lg:justify-self-end">
          {featured ? (
            <FeaturedMatch initial={featured} />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center text-zinc-400">
              <p className="text-lg font-bold text-white">No matches yet</p>
              <p className="mt-1">Create a room and the first match shows up here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Faint kabaddi court markings behind the hero: boundary, midline, baulk and bonus lines. */
function CourtLines() {
  return (
    // Inline position and opacity so the lines stay a faint background even before the stylesheet loads.
    <svg
      aria-hidden
      style={{ position: "absolute", inset: 0, zIndex: -10, width: "100%", height: "100%", opacity: 0.07 }}
      preserveAspectRatio="none"
      viewBox="0 0 100 60"
    >
      <g fill="none" stroke="white" strokeWidth="0.25">
        <rect x="6" y="8" width="88" height="44" />
        <line x1="50" y1="8" x2="50" y2="52" />
        <line x1="34" y1="8" x2="34" y2="52" />
        <line x1="66" y1="8" x2="66" y2="52" />
        <line x1="28" y1="8" x2="28" y2="52" strokeDasharray="1 1" />
        <line x1="72" y1="8" x2="72" y2="52" strokeDasharray="1 1" />
      </g>
    </svg>
  );
}

function MatchSections({ lists }: { lists: MatchLists }) {
  const sections = [
    { title: "Live now", matches: lists.live, empty: "No matches live right now." },
    { title: "Upcoming", matches: lists.upcoming, empty: "No upcoming matches." },
    { title: "Finished", matches: lists.finished, empty: "No finished matches yet." },
  ];
  return (
    <>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{section.title}</h2>
            <span className="text-sm font-semibold text-zinc-500">{section.matches.length}</span>
          </div>
          {section.matches.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-800">
              {section.empty}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Create a room", text: "Register as an admin and set up the match: teams, time, and any rule changes." },
    { title: "Score from the mat", text: "Big buttons for every raid result. All outs, super tackles and do-or-die are automatic." },
    { title: "Share and stream", text: "Send the scoreboard link to fans and add the overlay link to OBS." },
  ];
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-black tracking-tight sm:text-3xl">How it works</h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-orange-600 font-black text-white">{i + 1}</span>
            <h3 className="mt-3 text-lg font-black">{step.title}</h3>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SetupNeeded() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-2xl font-black">Connect a data source</h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">Matches show here once one of these is set in your env file:</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <h3 className="font-black">Try it with demo data</h3>
          <code className="mt-2 block font-mono text-sm">NEXT_PUBLIC_MOCK=true</code>
        </div>
        <div className="rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <h3 className="font-black">Use Supabase</h3>
          <code className="mt-2 block font-mono text-sm">
            SUPABASE_URL=...
            <br />
            SUPABASE_PUBLISHABLE_KEY=...
          </code>
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-500">Restart npm run dev after changing it. Full steps are in README.md.</p>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-zinc-500">
        <Logo className="text-zinc-950 dark:text-white" />
        <span>{MOCK ? "Demo mode: data is made up and resets when the server restarts." : "Live kabaddi scores."}</span>
      </div>
    </footer>
  );
}
