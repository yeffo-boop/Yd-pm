"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/server/ports/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  callbackUrl: z.string().optional(),
});

export interface LoginActionState {
  error: string | null;
}

/**
 * Deliberately generic on every failure path — invalid input, unknown
 * email, wrong password, and rate-limited all render identically
 * ("Invalid email or password.") so the response can never be used to
 * enumerate accounts (docs/security.md §2).
 */
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    callbackUrl: formData.get("callbackUrl") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Invalid email or password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.callbackUrl || "/",
    });
    return { error: null };
  } catch (error) {
    // next-auth's signIn() throws a framework-internal redirect signal on
    // success — only an actual AuthError means the sign-in failed.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
}
