// API Base URL & Fetch Interceptor for Web + Capacitor (Android / iOS) + Vercel
const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const API_BASE_URL = rawBase;

/**
 * Resolve `/api/...` path using `VITE_API_BASE_URL` when running inside Capacitor
 * or pointing to an external Vercel backend; keeps relative `/api/...` on same-origin web.
 */
export function apiUrl(path) {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

let fetchPatched = false;

/**
 * Automatically prefix relative `/api/...` fetch requests with `VITE_API_BASE_URL`
 * when configured (e.g., for Android/iOS Capacitor builds pointing to Vercel).
 */
export function setupApiFetch() {
  if (fetchPatched || typeof window === 'undefined' || !API_BASE_URL) return;
  fetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return nativeFetch(apiUrl(input), init);
    }
    if (input instanceof Request) {
      try {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && u.pathname.startsWith('/api')) {
          const nextReq = new Request(apiUrl(u.pathname + u.search), input);
          return nativeFetch(nextReq, init);
        }
      } catch {
        // Fallback to native fetch if URL parsing fails
      }
    }
    return nativeFetch(input, init);
  };
}
