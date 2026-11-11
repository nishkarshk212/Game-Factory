const TOKEN_KEY = 'gv_sonic_token';
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null, persistLocal = false) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (persistLocal) localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const target = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(target, { ...options, headers });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json as T;
}
