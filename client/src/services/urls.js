// Use same-origin API on hosted builds; keep local Vite development working.
const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const localAddress = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configured);
export const API_BASE = import.meta.env.PROD && localAddress ? '/api' : (configured || (import.meta.env.DEV ? 'http://localhost:3333/api' : '/api'));
export function assetUrl(value) {
  if (!value) return '';
  if (value.startsWith('/uploads/')) {
    const origin = API_BASE.replace(/\/api\/?$/, '');
    return `${origin}${value}`;
  }
  return value;
}
