import type { User, Pipeline, RoleRequest } from "./types";

// Détection : si on est chargé via oauth2-proxy, window.location.hostname sera celui d'oauth2-proxy
// On vérifie aussi si le document a été chargé avec des headers oauth2-proxy
const isViaProxy = window.location.port === "4180" || window.location.hostname !== "localhost";
const API = isViaProxy ? "" : (import.meta.env.VITE_API_URL || "http://localhost:8000");
export const API_BASE = API;

console.log(`[API] isViaProxy: ${isViaProxy}, API: "${API}", port: ${window.location.port}`);

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`API Error [${res.status}]:`, text);
    throw new Error(text || `HTTP ${res.status}`);
  }

  const txt = await res.text();
  
  // Vérifier que la réponse est bien du JSON
  if (!txt) return null as T;
  
  try {
    return JSON.parse(txt) as T;
  } catch (e) {
    console.error("Failed to parse JSON:", txt.substring(0, 100));
    throw new Error("Invalid JSON response from server");
  }
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

  deleteUser: (userId: number) =>
    api<{ ok: boolean; id: number; username: string; deleted_role_requests: number }>(
      `/api/admin/users/${userId}`,
      { method: "DELETE" }
    ),

  // ===== ROLE REQUESTS =====
  requestRole: (requestedRole: string) =>
    api<RoleRequest>("/api/users/me/request-role", {
      method: "POST",
      body: JSON.stringify({ requested_role: requestedRole }),
    }),

  getMyRequests: () => api<RoleRequest[]>("/api/users/me/requests"),

  getAvailableRoles: () => api<string[]>("/api/users/me/available-roles"),

  // Admin only
  getAllRoleRequests: () => api<RoleRequest[]>("/api/admin/role-requests"),

  approveRoleRequest: (requestId: number) =>
    api<{ ok: boolean; request_id: number; user_id: number; new_role: string }>(
      `/api/admin/role-requests/${requestId}/approve`,
      { method: "PUT" }
    ),

  rejectRoleRequest: (requestId: number) =>
    api<{ ok: boolean; request_id: number }>(`/api/admin/role-requests/${requestId}/reject`, {
      method: "PUT",
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

  deletePipeline: (id: number) =>
    api<{ ok: boolean; message: string; pipeline_id: number }>(`/api/pipelines/${id}`, {
      method: "DELETE",
    }),
};

export const runAPI = {
  history: (runId: number) => api<any[]>(`/api/runs/${runId}/history`),

  getLogs: async (pipelineId: number): Promise<string> => {
    const res = await fetch(`${API}/api/pipelines/${pipelineId}/logs`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  },
};
