import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-black">Not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">This match or room doesn&apos;t exist, or isn&apos;t yours.</p>
      <Link href="/" className="font-semibold text-orange-600 underline">
        All matches
      </Link>
    </main>
  );
}
