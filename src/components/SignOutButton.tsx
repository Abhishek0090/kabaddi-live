"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";
import { clearPageCaches } from "@/lib/pwa";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await clearPageCaches();
          await signOut();
        })
      }
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
