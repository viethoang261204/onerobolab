import { useSessionStore } from '../session/session-store';
import { createApiClient } from './client';

/**
 * The console's API client. `VITE_API_URL` is the API origin in production
 * (e.g. https://onerobolab-api.onrender.com); empty = same origin, which the
 * Vite dev server proxies to the local API. It is a public URL, not a secret.
 */
const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const api = createApiClient({
  baseUrl,
  getToken: () => useSessionStore.getState().token,
  onUnauthorized: () => useSessionStore.getState().signedOut('Your session ended. Please sign in again.'),
});
