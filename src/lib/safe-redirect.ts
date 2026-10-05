/**
 * Returns `target` only if it is a same-site relative path; otherwise `fallback`.
 * Blocks open redirects such as `?callbackUrl=https://evil.example`,
 * protocol-relative `//evil.example`, and backslash tricks like `/\evil.example`.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = '/colleges'): string {
  if (!target) return fallback;
  if (!target.startsWith('/')) return fallback;
  if (target.startsWith('//') || target.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(target)) return fallback;
  try {
    const url = new URL(target, 'http://placeholder.local');
    if (url.host !== 'placeholder.local') return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
