/**
 * The only module outside src/server/adapters/auth-authjs that is allowed
 * to import from `next-auth` (ADR 0003) — everything else in the app
 * (server components, server actions, route handlers) calls
 * `getCurrentIdentity()` and works with the framework-agnostic `Identity`
 * type from src/server/services/authorization.ts. Swapping identity
 * providers later (e.g. adding WordPress SSO) means changing this file and
 * the adapter behind it, not every call site that needs to know who's
 * signed in.
 */
import { auth, signIn, signOut } from "@/server/adapters/auth-authjs";
import { loadIdentity, type Identity } from "@/server/services/authorization";

export { signIn, signOut };

/**
 * Resolves the current request's authenticated `Identity`, or `null` if
 * there isn't one (no session, invalidated token, disabled/deleted user).
 * Safe to call from Server Components, Server Actions, and Route Handlers.
 */
export async function getCurrentIdentity(): Promise<Identity | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }
  return loadIdentity(userId);
}
