"use server";

import { signOut } from "@/server/ports/auth";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
