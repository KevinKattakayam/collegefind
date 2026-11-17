import { createHash } from 'node:crypto';

export function checksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function sourceIdentity(source: { publisher: string; url: string }, contentChecksum: string): string {
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Source requires a public HTTPS URL');
  if (!source.publisher.trim()) throw new Error('Source publisher is required');
  return checksum([source.publisher.trim(), url.href, contentChecksum]);
}
