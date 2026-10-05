/** Public base URL. Set NEXT_PUBLIC_SITE_URL in each environment. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
