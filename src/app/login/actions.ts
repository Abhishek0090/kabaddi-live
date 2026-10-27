"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { setMockSession } from "@/lib/mock/session";
import { DEMO_ADMIN, mockSignIn, mockSignUp } from "@/lib/mock/store";
import { MOCK } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string };

/** Only same-site paths, so `next` can't send people to another site. */
function safeNext(raw: FormDataEntryValue | null): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/scorer";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Enter your email and password." };

  if (MOCK) {
    const userId = mockSignIn(email, password);
    if (!userId) return { error: "Wrong email or password. Try the demo account below." };
    await setMockSession(userId);
    redirect(safeNext(formData.get("next")));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: error.code === "email_not_confirmed" ? "Confirm your email first. Check your inbox." : "Wrong email or password.",
    };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const confirm = String(formData.get("confirm") ?? "");
  if (!email || !password) return { error: "Enter an email and a password." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  if (password !== confirm) return { error: "The passwords don't match." };

  if (MOCK) {
    const result = mockSignUp(email, password);
    if ("error" in result) return { error: result.error };
    await setMockSession(result.id);
    redirect("/scorer");
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/scorer` },
  });
  if (error) {
    if (error.code === "signup_disabled") return { error: "Registration is turned off for this site." };
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many sign-ups right now. Try again in an hour." };
    }
    return { error: error.message };
  }
  // With "Confirm email" off in Supabase, sign-up logs the user in straight away.
  if (data.session) redirect("/scorer");
  return { message: `Check ${email} for a confirmation link, then log in.` };
}

export async function signOut(): Promise<void> {
  if (MOCK) {
    await setMockSession(null);
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/** Mock mode only: one-click login as the demo admin. */
export async function signInDemo(formData: FormData): Promise<void> {
  if (!MOCK) redirect("/login");
  const userId = mockSignIn(DEMO_ADMIN.email, DEMO_ADMIN.password);
  if (userId) await setMockSession(userId);
  redirect(safeNext(formData.get("next")));
}
