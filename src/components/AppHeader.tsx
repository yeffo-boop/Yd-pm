import { signOutAction } from "@/app/actions";

export function AppHeader({ workspaceLabel }: { workspaceLabel: string }) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-6 py-4">
      <div className="flex items-baseline gap-3">
        <span className="text-base font-semibold text-[var(--color-text-primary)]">
          YeffoHub
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {workspaceLabel}
        </span>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-[var(--radius-sm)] border border-[var(--color-surface-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-brand-primary)] hover:text-[var(--color-text-primary)]"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
