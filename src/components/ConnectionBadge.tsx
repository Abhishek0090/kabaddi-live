import type { LiveStatus } from "@/lib/useLiveMatch";

const text: Record<LiveStatus, string> = { connecting: "Connecting...", live: "Live", reconnecting: "Reconnecting..." };

export function ConnectionBadge({ status, className = "" }: { status: LiveStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${className}`} aria-live="polite">
      <span
        className={`h-2.5 w-2.5 rounded-full ${status === "live" ? "animate-pulse bg-red-600" : "bg-amber-500"}`}
        aria-hidden
      />
      {text[status]}
    </span>
  );
}
