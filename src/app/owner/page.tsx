import type { Metadata } from "next";
import { getCurrentIdentity } from "@/server/ports/auth";
import { listProjectsForIdentity } from "@/server/repositories/project-repository";

export const metadata: Metadata = { title: "Dashboard — YeffoHub" };

export default async function OwnerDashboardPage() {
  // Layout already guarantees an OWNER identity; re-fetching here keeps
  // this page correct in isolation too, and costs one cheap query.
  const identity = await getCurrentIdentity();
  const projects = identity ? await listProjectsForIdentity(identity) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Attention items, upcoming deadlines, and overdue tasks land here starting in
          Phase 3. This is the Phase 1 foundation shell — it proves the owner identity
          resolves correctly and pulls every project across every client company,
          unfiltered.
        </p>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-6">
        <h2 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
          All projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-surface-border)] px-4 py-3"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  {project.name}
                </span>
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  {project.slug}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
