import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';
import { loginSchema } from './validation';
import { checkRateLimit } from './rate-limit';
import { clientIpFromHeaders } from './http';
import { logger } from './logger';

// bcrypt hash of a random string. Compared against when the email does not
// exist so that "no such user" and "wrong password" take the same time.
const DUMMY_HASH = '$2b$12$6GzIT.fv9BNkILiaSNxMf.wc/NzLpEMg9pyGC1kIHZuz2pB3WjlLe';

export const TOO_MANY_ATTEMPTS = 'TooManyAttempts';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials ?? {});
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = clientIpFromHeaders(req?.headers as Record<string, unknown> | undefined);
        const [byIp, byAccount] = await Promise.all([
          checkRateLimit('loginIp', ip),
          checkRateLimit('login', `${ip}:${email}`),
        ]);
        if (!byIp.success || !byAccount.success) {
          logger.warn('login_rate_limited', { ip });
          throw new Error(TOO_MANY_ATTEMPTS);
        }

        // Case-insensitive lookup keeps accounts created before emails were
        // normalised to lowercase working.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true, email: true, name: true, password: true, role: true },
        });
        const ok = await compare(password, user?.password ?? DUMMY_HASH);
        if (!user || !ok) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: 'USER' | 'ADMIN' }).role ?? 'USER';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? 'USER';
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};
