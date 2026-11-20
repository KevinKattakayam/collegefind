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
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
  const tooLarge = () => new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  if (Number(request.headers.get('content-length')) > maxBytes) throw tooLarge();
  const reader = request.body?.getReader();
  let text = '';
  if (reader) {
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => {});
          throw tooLarge();
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
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

/** Cookie-authenticated mutations trust the configured origin in production. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin && request.headers.get('sec-fetch-site') !== 'cross-site') return;
  try {
    const configured = process.env.NEXTAUTH_URL;
    const expected = configured ? new URL(configured).origin
      : process.env.NODE_ENV === 'production' ? null : new URL(request.url).origin;
    if (origin && expected && origin === expected) return;
  } catch {
    // Invalid configuration or origin is rejected without logging its contents.
  }
  throw new ApiError(403, 'BAD_ORIGIN', 'Cross-origin request rejected');
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
  if (process.env.VERCEL === '1') return get('x-vercel-forwarded-for')?.trim() || 'unknown';
  const xff = get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || 'unknown';
  return get('x-real-ip') ?? 'unknown';
}

export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}

export const CACHE_PUBLIC_SHORT = 'public, s-maxage=60, stale-while-revalidate=300';
export const CACHE_NONE = 'private, no-store';
