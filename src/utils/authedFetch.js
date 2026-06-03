import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

// Single in-flight re-login promise so concurrent 401s don't trigger a stampede
// of /auth/login calls.
let reloginInFlight = null;

async function silentRelogin() {
  if (reloginInFlight) return reloginInFlight;
  reloginInFlight = (async () => {
    try {
      const email = await SecureStore.getItemAsync('savedEmail');
      const password = await SecureStore.getItemAsync('savedPassword');
      if (!email || !password) return null;

      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const token = data && data.access_token;
      if (!token) return null;

      await SecureStore.setItemAsync('token', token);
      await SecureStore.setItemAsync('user', JSON.stringify({
        id: data.user_id,
        email,
        role: data.role,
        expires_at: data.expires_at,
      }));
      return token;
    } catch (e) {
      console.log('[silentRelogin] failed:', e?.message);
      return null;
    } finally {
      // Allow future re-logins after this one settles.
      setTimeout(() => { reloginInFlight = null; }, 0);
    }
  })();
  return reloginInFlight;
}

function buildHeaders(token, extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// authedFetch — like fetch, but adds the bearer token automatically and
// transparently re-logs in once on 401/403 using stored credentials, then
// replays the request. Keeps the user signed in across token expiry.
export async function authedFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  let token = await SecureStore.getItemAsync('token');
  let res = await fetch(url, { ...options, headers: buildHeaders(token, options.headers) });

  if (res.status === 401 || res.status === 403) {
    const newToken = await silentRelogin();
    if (newToken) {
      res = await fetch(url, { ...options, headers: buildHeaders(newToken, options.headers) });
    }
  }
  return res;
}

export { silentRelogin };
