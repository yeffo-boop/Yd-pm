import { redirect } from "next/navigation";
import { getCurrentIdentity } from "@/server/ports/auth";

export default async function RootPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/login");
  }
  redirect(identity.role === "OWNER" ? "/owner" : "/client");
}
