const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include", // ✅ pour cookies oauth2-proxy
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const API_BASE = API;
