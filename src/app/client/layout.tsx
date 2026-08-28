import { redirect } from "next/navigation";
import { getCurrentIdentity } from "@/server/ports/auth";
import { AppHeader } from "@/components/AppHeader";

/** See src/app/owner/layout.tsx for why this check exists alongside proxy.ts. */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/login");
  }
  if (identity.role !== "CLIENT") {
    redirect("/owner");
  }

  return (
    <div className="min-h-screen">
      <AppHeader workspaceLabel="Client portal" />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
