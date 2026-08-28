import { NextResponse } from "next/server";

/**
 * Liveness only — "the process can handle a request" — deliberately does
 * not touch the database (that's /api/ready). No secrets, no stack
 * traces, no internal detail in the response body (ADR 0007).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" });
}
