/**
 * Minimal structured logger. Emits one JSON object per line so Vercel/any log
 * drain can index fields. Never pass passwords, tokens, or full request bodies.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
};

export function errorFields(err: unknown): Record<string, unknown> {
  // Driver messages and stacks can contain connection URLs, query values or paths.
  return { errorType: err instanceof Error ? err.constructor.name : typeof err };
}
