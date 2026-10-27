import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { btn } from "@/components/ui";
import { DEMO_ADMIN } from "@/lib/mock/store";
import { MOCK } from "@/lib/mode";
import { signIn, signInDemo } from "./actions";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;

  return (
    <AuthShell title="Admin login" subtitle="Log in to score your match rooms.">
      {MOCK && (
        <form action={signInDemo} className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
          {nextPath && <input type="hidden" name="next" value={nextPath} />}
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Demo mode. Use <span className="font-mono">{DEMO_ADMIN.email}</span> /{" "}
            <span className="font-mono">{DEMO_ADMIN.password}</span>, or:
          </p>
          <button className={btn.dark}>Log in as demo admin</button>
        </form>
      )}
      <AuthForm mode="login" action={signIn} next={nextPath} initialError={typeof error === "string" ? error : undefined} />
    </AuthShell>
  );
}
