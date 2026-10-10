import { timingSafeEqual } from "node:crypto";

export function isIndexingAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !secret) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
