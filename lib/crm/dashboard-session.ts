type SessionResponse = Pick<Response, "ok" | "status" | "json">;
type SessionFetch = (url: string, init: RequestInit) => Promise<SessionResponse>;

export function isCurrentCrmSession(
  session: { user?: { id?: string | number } | null } | null,
  userId: string,
): boolean {
  return Boolean(session?.user?.id && String(session.user.id) === userId);
}

/** Use Payload's existing logout endpoint and verify its auth cookie is gone. */
export async function endCrmSession(fetcher: SessionFetch): Promise<void> {
  const logout = await fetcher("/api/users/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!logout.ok) throw new Error("Logout request failed");

  const session = await fetcher("/api/users/me", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (session.status === 401) return;
  if (!session.ok) throw new Error("Session verification failed");
  const result = await session.json() as { user?: { id?: string | number } | null };
  if (result.user?.id) throw new Error("Session remains active");
}
