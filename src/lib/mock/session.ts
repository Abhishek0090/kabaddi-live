import { cookies } from "next/headers";
import { MOCK_SESSION_COOKIE } from "../mode";
import { mockUser } from "./store";

export async function mockSessionUser(): Promise<{ id: string; email: string } | null> {
  return mockUser((await cookies()).get(MOCK_SESSION_COOKIE)?.value);
}

export async function setMockSession(userId: string | null): Promise<void> {
  const jar = await cookies();
  if (userId) {
    jar.set(MOCK_SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  } else {
    jar.delete(MOCK_SESSION_COOKIE);
  }
}
