import Link from "next/link";
import { MOCK } from "@/lib/mode";
import { Logo } from "./Logo";

/** Top bar for public pages. Sits on the dark hero, so it is always light-on-dark. */
export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 text-white">
      <div className="flex items-center gap-3">
        <Logo />
        {MOCK && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
            Demo data
          </span>
        )}
      </div>
      <nav className="flex items-center gap-1 text-sm font-semibold">
        <a href="#matches" className="hidden rounded-lg px-3 py-2 text-zinc-300 hover:text-white sm:inline-block">
          Matches
        </a>
        <Link href="/login" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-white">
          Log in
        </Link>
        <Link href="/register" className="rounded-lg bg-white px-3 py-2 text-zinc-950 hover:bg-zinc-200">
          Create a room
        </Link>
      </nav>
    </header>
  );
}
