import type { User, Pipeline, RoleChangeRequest, AuthUser, Role } from "./types";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
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

// Auth
export const authAPI = {
  getCurrentUser: () => api<AuthUser>("/api/auth/me"),
  checkOrCreateUser: () => api<User>("/api/auth/check-or-create", { method: "POST" }),
};

// Users / Roles
export const userAPI = {
  // admin
  getAllUsers: () => api<User[]>("/api/users"),

  // admin
  updateUserRole: (username: string, role: Role) =>
    api<User>(`/api/users/${username}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  // viewer -> request to become contributor
  requestRoleChange: (username: string, requestedRole: Role, message: string) =>
    api<RoleChangeRequest>("/api/users/role-request", {
      method: "POST",
      body: JSON.stringify({
        username,
        requested_role: requestedRole,
        message,
      }),
    }),

  // admin (optional, si tu l’ajoutes côté back)
  getRoleRequests: () => api<RoleChangeRequest[]>("/api/users/role-requests"),
};

// Pipelines
export const pipelineAPI = {
  getAllPipelines: () => api<Pipeline[]>("/api/pipelines"),

  // ton back pipeline attend {name, repo_url, branch}
  createPipeline: (name: string, repoUrl: string, branch = "main") =>
    api<Pipeline>("/api/pipelines", {
      method: "POST",
      body: JSON.stringify({ name, repo_url: repoUrl, branch }),
    }),

  runPipeline: (id: number) =>
    api<{ runId: number }>(`/api/pipelines/${id}/run`, { method: "POST" }),
};
