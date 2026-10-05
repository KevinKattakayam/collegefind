import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError, type ZodType } from 'zod';
import { logger, errorFields } from './logger';

/** An error that is safe to show to the client. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string>,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function zodDetails(err: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!details[key]) details[key] = issue.message;
  }
  return details;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_FAILED', details: zodDetails(err) },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Already exists', code: 'CONFLICT' }, { status: 409 });
    }
    if (err.code === 'P2025' || err.code === 'P2003') {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
    }
  }
  const requestId = crypto.randomUUID();
  logger.error('unhandled_api_error', { requestId, ...errorFields(err) });
  // Never leak internal messages (the old seed route returned error.message).
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL', requestId },
    { status: 500 },
  );
}

/** Wraps a route handler so every thrown error becomes a consistent JSON response. */
export function withErrorHandling<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

const DEFAULT_MAX_BODY_BYTES = 16 * 1024;

/**
 * Reads and validates a JSON body. Rejects non-JSON content types (415),
 * oversized bodies (413) and malformed JSON (400) before validation.
 */
export async function readJson<T>(request: Request, schema: ZodType<T>, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  return schema.parse(raw);
}

export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = new URL(request.url).searchParams;
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return schema.parse(obj);
}

/**
 * CSRF defence in depth for cookie-authenticated mutations. Browsers always send
 * `Origin` on cross-site POST/DELETE; if it is present it must match this host.
 * Session cookies are also SameSite=Lax (NextAuth default).
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'BAD_ORIGIN', 'Cross-origin request rejected');
  }
  const allowed = new Set<string>();
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) allowed.add(host);
  try {
    allowed.add(new URL(request.url).host);
  } catch {
    /* ignore */
  }
  if (process.env.NEXTAUTH_URL) {
    try {
      allowed.add(new URL(process.env.NEXTAUTH_URL).host);
    } catch {
      /* ignore */
    }
  }
  if (!allowed.has(originHost)) {
    throw new ApiError(403, 'BAD_ORIGIN', 'Cross-origin request rejected');
  }
}

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform.
 * Behind other proxies make sure they overwrite (not append to) this header.
 */
export function clientIpFromHeaders(headers: Headers | Record<string, unknown> | undefined): string {
  if (!headers) return 'unknown';
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const v = (headers as Record<string, unknown>)[name];
    return Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : undefined;
  };
  const xff = get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return get('x-real-ip') ?? 'unknown';
}

export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

export const CACHE_PUBLIC_SHORT = 'public, s-maxage=60, stale-while-revalidate=300';
export const CACHE_NONE = 'private, no-store';
