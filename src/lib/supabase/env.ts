// SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY reach the browser through `env` in
// next.config.ts. They must be referenced literally (no destructuring) so Next
// can replace them at build time.

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local, fill them in, and restart.",
    );
  }
  return { url, key };
}
