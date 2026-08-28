import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — YeffoHub",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] p-8 shadow-[var(--shadow-md)]">
        <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-primary)]">
          YeffoHub
        </h1>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Sign in to your workspace.
        </p>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
