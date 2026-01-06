import { User, Pipeline, RoleChangeRequest } from "./types";

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
  getCurrentUser: () => api<AuthUser>("/api/auth/me"),
  
  // Vérifie si l'utilisateur existe dans la BD, sinon le crée avec rôle viewer
  checkOrCreateUser: () => api<User>("/api/auth/check-or-create", { method: "POST" }),
};

// User & Role Management
export const userAPI = {
  // Liste tous les utilisateurs (admin only)
  getAllUsers: () => api<User[]>("/api/users"),
  
  // Met à jour le rôle d'un utilisateur (admin only)
  updateUserRole: (username: string, role: string) =>
    api<User>(`/api/users/${username}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  
  // Demande un changement de rôle (viewer uniquement)
  requestRoleChange: (requestedRole: string) =>
    api<RoleChangeRequest>("/api/users/role-request", {
      method: "POST",
      body: JSON.stringify({ requested_role: requestedRole }),
    }),
  
  // Liste les demandes de changement de rôle (admin only)
  getRoleRequests: () => api<RoleChangeRequest[]>("/api/users/role-requests"),
  
  // Approuve/rejette une demande de changement de rôle (admin only)
  reviewRoleRequest: (requestId: number, approved: boolean) =>
    api<RoleChangeRequest>(`/api/users/role-requests/${requestId}`, {
      method: "PUT",
      body: JSON.stringify({ approved }),
    }),
};

// Pipeline Management
export const pipelineAPI = {
  // Liste tous les pipelines
  getAllPipelines: () => api<Pipeline[]>("/api/pipelines"),
  
  // Crée un nouveau pipeline (contributor & admin)
  createPipeline: (githubUrl: string, name: string) =>
    api<Pipeline>("/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ github_url: githubUrl, name }),
    }),
  
  // Obtient un pipeline par ID
  getPipeline: (id: number) => api<Pipeline>(`/api/pipelines/${id}`),
  
  // Lance un pipeline (contributor & admin)
  runPipeline: (id: number) =>
    api<Pipeline>(`/api/pipelines/${id}/run`, { method: "POST" }),
};

