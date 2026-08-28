import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { z } from "zod";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/security/password";
import { checkRateLimit } from "@/server/security/rate-limit";
import "./types";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/** Login attempts per (ip, email) pair inside a 15-minute window. */
const LOGIN_RATE_LIMIT = { windowSeconds: 15 * 60, max: 10 } as const;

function clientIpFrom(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials, request) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;

        const rateLimitKey = `${clientIpFrom(request)}:${email}`;
        const limit = await checkRateLimit("login", rateLimitKey, LOGIN_RATE_LIMIT);
        if (!limit.allowed) {
          // Same generic failure as a bad password — never reveal that
          // the request was throttled rather than rejected on credentials
          // (docs/security.md §2, §8).
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE" || user.deletedAt) {
          return null;
        }

        const passwordMatches = await verifyPassword(user.passwordHash, password);
        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fresh sign-in: `user` is exactly what `authorize()` returned.
        token.userId = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
      }

      if (!token.userId) {
        return null;
      }

      // Re-checked on every request, not just at sign-in — this is the
      // mechanism that makes a password change or account disable take
      // effect immediately instead of waiting for token expiry (ADR 0003
      // "Revision").
      const current = await prisma.user.findUnique({
        where: { id: token.userId },
        select: { status: true, tokenVersion: true, deletedAt: true, role: true },
      });

      if (!current || current.deletedAt || current.status !== "ACTIVE") {
        return null;
      }
      if (current.tokenVersion !== token.tokenVersion) {
        return null;
      }

      // Keep role in sync in case it's ever changed server-side.
      token.role = current.role;

      return token;
    },
    async session({ session, token }) {
      if (!token.userId || !token.role) {
        // jwt() already rejected this token; nothing valid to expose.
        return session;
      }
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
};
