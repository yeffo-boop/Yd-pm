import type { Metadata } from "next";
import { getCurrentIdentity } from "@/server/ports/auth";
import { listProjectsForIdentity } from "@/server/repositories/project-repository";

export const metadata: Metadata = { title: "Dashboard — YeffoHub" };

export default async function ClientDashboardPage() {
  const identity = await getCurrentIdentity();
  const projects = identity ? await listProjectsForIdentity(identity) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Your projects
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Next actions, upcoming dates, and items awaiting your input land here starting
          in Phase 5. This Phase 1 shell proves you only ever see your own company&apos;s
          published projects — never another client&apos;s.
        </p>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-6">
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No projects are visible to you yet.
          </p>
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
