import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" className="text-sm font-semibold text-zinc-500 hover:underline">
        Kabaddi Live Score
      </Link>
      <h1 className="text-3xl font-black">Admin login</h1>
      <AuthForm
        mode="login"
        action={signIn}
        next={typeof next === "string" ? next : undefined}
        initialError={typeof error === "string" ? error : undefined}
      />
    </main>
  );
}
