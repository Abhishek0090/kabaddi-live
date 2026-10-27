"use client";

import { btn } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-black">Something went wrong</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">{error.message || "Please try again."}</p>
      <button className={btn.primary} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
