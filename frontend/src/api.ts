import type { User, Pipeline } from "./types";

// Si on accède via oauth2-proxy (port 4180), utiliser une URL relative
// Sinon utiliser l'URL directe du backend pour le dev
const isOAuth2Proxy = window.location.port === "4180";
const API = isOAuth2Proxy ? "" : (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000");
export const API_BASE = API;

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

export const authAPI = {
  getCurrentUser: () => api<User>("/api/me"),
};

export const userAPI = {
  getAllUsers: () => api<User[]>("/api/admin/users"),

  createUser: (username: string, role: string, email?: string) =>
    api<User>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, role, email }),
    }),

  updateUserRole: (userId: number, role: string) =>
    api<{ ok: boolean; id: number; role: string }>(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
};

export const pipelineAPI = {
  getAllPipelines: () => api<Pipeline[]>("/api/pipelines"),

  createPipeline: (name: string, githubUrl: string, branch = "main") =>
    api<Pipeline>("/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ name, github_url: githubUrl, branch }),
    }),

  runPipeline: (id: number) =>
    api<{ runId: number }>(`/api/pipelines/${id}/run`, { method: "POST" }),
};

export const runAPI = {
  history: (runId: number) => api<any[]>(`/api/runs/${runId}/history`),
  
  getLogs: async (runId: number): Promise<string> => {
    const res = await fetch(`${API}/api/runs/${runId}/logs`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  },
};
