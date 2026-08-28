import { redirect } from "next/navigation";
import { getCurrentIdentity } from "@/server/ports/auth";
import { AppHeader } from "@/components/AppHeader";

/**
 * Page/layout-level authorization check — defense layer 3 of the 5 named
 * in docs/permissions.md §5. src/proxy.ts already redirects unauthorized
 * requests before they get this far; this check exists so the route is
 * still correct even if reached some other way (a direct server-side
 * render path, a future refactor of proxy.ts, etc).
 */
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/login");
  }
  if (identity.role !== "OWNER") {
    redirect("/client");
  }

  return (
    <div className="min-h-screen">
      <AppHeader workspaceLabel="Owner workspace" />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
