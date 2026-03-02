/**
 * NextAuth.js v5 configuration.
 *
 * Two providers are registered depending on environment variables:
 *  - Credentials ("mock"): active when MOCK_AUTH=true — for local development.
 *  - MicrosoftEntraID: active when AUTH_ENTRA_CLIENT_ID is set — for production.
 *
 * The JWT always stores the *database* user ID in token.sub so that
 * getCurrentUser() can do a single DB lookup regardless of provider.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordLastLogin } from "@/services/users";

// ── Type augmentation ──────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// ── Provider list ──────────────────────────────────────────────────

const mockProvider =
  process.env.MOCK_AUTH === "true"
    ? Credentials({
        id: "mock",
        name: "Mock User",
        credentials: {
          userId: { label: "User ID", type: "text" },
        },
        async authorize(credentials) {
          const userId = (credentials.userId as string | undefined) ?? "";
          if (!userId) return null;
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (!user) return null;
          return { id: user.id, name: user.name, email: user.email };
        },
      })
    : null;

const entraProvider =
  process.env.AUTH_ENTRA_CLIENT_ID
    ? MicrosoftEntraID({
        clientId: process.env.AUTH_ENTRA_CLIENT_ID,
        clientSecret: process.env.AUTH_ENTRA_CLIENT_SECRET!,
        issuer: process.env.AUTH_ENTRA_ISSUER,
      })
    : null;

const providers = [mockProvider, entraProvider].filter(Boolean) as Array<
  NonNullable<typeof mockProvider | typeof entraProvider>
>;

// ── NextAuth config ────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      // Credentials provider — authorize() already returns a DB user; id goes into token.sub
      if (account?.provider === "mock" && user?.id) {
        token.sub = user.id;
        await recordLastLogin(db, user.id);
      }

      // Entra provider — first sign-in: find or create a DB user, record login
      if (account?.provider === "microsoft-entra-id" && user?.email) {
        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (existing) {
          token.sub = existing.id;
          await recordLastLogin(db, existing.id);
        } else {
          const newId = `usr-${crypto.randomUUID()}`;
          await db.insert(users).values({
            id: newId,
            name: user.name ?? user.email.split("@")[0],
            email: user.email,
            isAdmin: false,
          });
          token.sub = newId;
          await recordLastLogin(db, newId);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
