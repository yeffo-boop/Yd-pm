import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Readiness — "the process can serve real traffic," i.e. the database is
 * reachable. Returns 503 rather than throwing on failure, and — like
 * /api/health — never includes the underlying error detail in the
 * response body (ADR 0007); the real error still goes to server logs.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
