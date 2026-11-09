export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// During the private pilot, provisioning users does not grant them access.
// Replace this restriction only after pipeline permissions are enforced in queries.
export function isPilotOwner(email: unknown, verified: unknown, ownerEmail: string): boolean {
  return typeof email === "string" && verified === true && Boolean(ownerEmail.trim()) &&
    normalizeEmail(email) === normalizeEmail(ownerEmail);
}

export function isSameOriginMutation(method: string, origin: string | undefined, appOrigin: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  return origin === appOrigin;
}

export function publicUser<T extends { password: unknown; googleSubject?: unknown }>(user: T) {
  const { password, googleSubject, ...safe } = user;
  return safe;
}
