import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Split layout for login and register: brand panel on large screens, form on the right. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_10%_0%,rgba(234,88,12,0.4),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(14,165,233,0.3),transparent)]"
        />
        <Logo />
        <div className="flex flex-col gap-4">
          <p className="text-5xl font-black leading-[0.95] tracking-tight">
            Run the score
            <br />
            from the mat.
          </p>
          <ul className="space-y-2 text-lg text-zinc-300">
            <li>Big buttons for every raid result</li>
            <li>All outs and super tackles worked out for you</li>
            <li>Keeps every tap, even without signal</li>
          </ul>
        </div>
        <p className="text-sm text-zinc-500">Each match room is scored by the admin who created it.</p>
      </aside>

      <section className="flex flex-col items-center justify-center gap-8 px-4 py-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
