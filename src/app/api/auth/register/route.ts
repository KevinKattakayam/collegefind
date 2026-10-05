import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError, assertSameOrigin, clientIp, readJson, withErrorHandling } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { registerSchema } from '@/lib/validation';

// Without email verification we cannot hide whether an address is registered
// (the user is signed in immediately). The message is deliberately generic and
// the endpoint is rate limited per IP. Full fix: email verification (ROADMAP).
const ACCOUNT_EXISTS = new ApiError(
  409,
  'ACCOUNT_UNAVAILABLE',
  'We could not create an account with these details. If you already have an account, sign in instead.',
);

export const POST = withErrorHandling(async (request: Request) => {
  assertSameOrigin(request);
  await enforceRateLimit('register', clientIp(request));
  const { name, email, password } = await readJson(request, registerSchema);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw ACCOUNT_EXISTS;

  try {
    const user = await prisma.user.create({
      data: { name, email, password: await hash(password, 12) },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw ACCOUNT_EXISTS;
    throw err;
  }
});
