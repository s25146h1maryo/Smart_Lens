import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [Google],
  callbacks: {
    async session({ session, token }: any) {
      // Pass data from token to session (No DB call here!)
      if (token && session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as any;
          session.user.jobTitle = token.jobTitle as string;
      }
      return session;
    },
    authorized({ auth }) {
        // Required for Middleware to work with the auth wrapper
        return !!auth?.user;
    }
  },
} satisfies NextAuthConfig;
