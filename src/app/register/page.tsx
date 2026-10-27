import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signUp } from "../login/actions";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-zinc-500 hover:underline">
        Kabaddi Live Score
      </Link>
      <div className="text-center">
        <h1 className="text-3xl font-black">Register as an admin</h1>
        <p className="mt-2 max-w-sm text-zinc-600 dark:text-zinc-400">
          Admins create match rooms and run the scoring for them.
        </p>
      </div>
      <AuthForm mode="register" action={signUp} />
    </main>
  );
}
