import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ensureIndexes, getDb, mongoConfigured } from "@/lib/mongodb";
import { seedState } from "@/lib/seed";

export const authEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET &&
    process.env.MONGODB_URI,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "not-configured",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "not-configured",
    }),
  ],
  secret: process.env.AUTH_SECRET ?? "dev-only-secret-change-me",
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ user, account }) {
      if (!mongoConfigured) return false;
      const db = await getDb();
      await ensureIndexes(db);
      const googleId = account?.providerAccountId ?? user.email ?? "unknown";
      const existing = await db.collection("users").findOne({ googleId });
      let userId: string;
      if (existing) {
        userId = existing.userId ?? String(existing._id);
      } else {
        userId = crypto.randomUUID();
        await db.collection("users").insertOne({
          userId,
          googleId,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          settings: seedState().settings,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      (user as { id?: string }).id = userId;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) session.user.id = String(token.userId);
      return session;
    },
  },
});
