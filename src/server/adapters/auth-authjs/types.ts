import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Module augmentation for Auth.js's Session/JWT shapes. This file is the
 * only place in the codebase that should need to know Auth.js's type
 * extension mechanism — everything else consumes `Identity` from
 * src/server/services/authorization.ts instead (ADR 0003).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    tokenVersion: number;
  }
}

// Augmenting the physical module ("@auth/core/jwt", which `next-auth/jwt`
// re-exports) rather than "next-auth/jwt" itself — with this project's
// `moduleResolution: "bundler"`, TypeScript cannot resolve the subpath
// re-export target for ambient augmentation purposes, even though the
// import itself resolves fine at runtime and in normal type-checking.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    tokenVersion?: number;
  }
}
