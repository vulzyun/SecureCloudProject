import type { User, Pipeline } from "./types";

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

// Auth & User Management
export const authAPI = {
  // Récupère l'utilisateur courant basé sur le header X-Auth-Request-User
  getCurrentUser: () => api<User>("/api/me"),
};

// User & Role Management
export const userAPI = {
  // Liste tous les utilisateurs (admin only)
  getAllUsers: () => api<User[]>("/api/admin/users"),
  
  // Crée un nouvel utilisateur (admin only)
  createUser: (username: string, role: string, email?: string) =>
    api<User>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, role, email }),
    }),
  
  // Met à jour le rôle d'un utilisateur (admin only)
  updateUserRole: (userId: number, role: string) =>
    api<{ ok: boolean; id: number; role: string }>(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
};

// Pipeline Management
export const pipelineAPI = {
  // Liste tous les pipelines
  getAllPipelines: () => api<Pipeline[]>("/api/pipelines"),
  
  // Crée un nouveau pipeline (dev & admin)
  createPipeline: (githubUrl: string, name: string) =>
    api<Pipeline>("/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ github_url: githubUrl, name }),
    }),
  
  // Obtient un pipeline par ID
  getPipeline: (id: number) => api<Pipeline>(`/api/pipelines/${id}`),
  
  // Lance un pipeline (dev & admin)
  runPipeline: (id: number) =>
    api<{ runId: number }>(`/api/pipelines/${id}/run`, { method: "POST" }),
};

