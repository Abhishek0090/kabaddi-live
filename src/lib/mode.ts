/**
 * Mock mode: NEXT_PUBLIC_MOCK="true" runs the whole app on in-memory demo data,
 * with no Supabase project. Data resets when the server restarts.
 */
export const MOCK = process.env.NEXT_PUBLIC_MOCK === "true";

/** Mock mode login cookie. Holds a demo user id; not a real session. */
export const MOCK_SESSION_COOKIE = "kabaddi-mock-session";
