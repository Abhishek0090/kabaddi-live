import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 font-black tracking-tight ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-600 text-lg text-white shadow-lg shadow-orange-600/30">
        K
      </span>
      <span className="text-lg leading-none">
        Kabaddi <span className="text-orange-500">Live</span>
      </span>
    </Link>
  );
}
