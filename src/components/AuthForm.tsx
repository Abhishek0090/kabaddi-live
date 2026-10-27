"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "@/app/login/actions";
import { btn, input, label } from "./ui";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  initialError?: string;
};

export function AuthForm({ mode, action, next, initialError }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: initialError });
  const isLogin = mode === "login";

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className={label}>
        Email
        <input className={input} type="email" name="email" autoComplete="email" required />
      </label>
      <label className={label}>
        Password
        <input
          className={input}
          type="password"
          name="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={isLogin ? undefined : 8}
          required
        />
      </label>
      {!isLogin && (
        <label className={label}>
          Confirm password
          <input className={input} type="password" name="confirm" autoComplete="new-password" required />
        </label>
      )}

      <p role="alert" aria-live="polite" className="min-h-6 text-sm font-semibold">
        {state.error && <span className="text-red-600 dark:text-red-400">{state.error}</span>}
        {state.message && <span className="text-green-700 dark:text-green-400">{state.message}</span>}
      </p>

      <button className={btn.primary} disabled={pending}>
        {pending ? "Please wait..." : isLogin ? "Log in" : "Create admin account"}
      </button>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {isLogin ? (
          <>
            New here?{" "}
            <Link className="font-semibold text-orange-600 underline" href="/register">
              Register as an admin
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link className="font-semibold text-orange-600 underline" href="/login">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
