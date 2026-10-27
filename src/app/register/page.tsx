import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { signUp } from "../login/actions";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="Create an admin account" subtitle="Admins create match rooms and run the scoring for them.">
      <AuthForm mode="register" action={signUp} />
    </AuthShell>
  );
}
