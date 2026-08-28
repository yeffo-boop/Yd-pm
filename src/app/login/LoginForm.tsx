"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "./actions";

const initialState: LoginActionState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {callbackUrl ? (
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={state.error ? "login-error" : undefined}
          className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-primary)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? "login-error" : undefined}
          className="rounded-[var(--radius-md)] border border-[var(--color-surface-border)] bg-[var(--color-surface-1)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-primary)]"
        />
      </div>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="text-sm text-[var(--color-status-danger)]"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-4 py-2 font-medium text-white transition-colors hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      {/*
        Forgot-password and invitation-acceptance flows are built in
        Phase 2 alongside the rest of the token/email infrastructure they
        share (see docs/phase-log.md) — no link to them yet to avoid a
        dead end.
      */}
    </form>
  );
}
