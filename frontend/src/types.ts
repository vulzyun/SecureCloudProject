export type Role = "viewer" | "contributor" | "admin";

export interface User {
  id: number;
  username: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface RoleChangeRequest {
  id: number;
  username: string;
  requested_role: Role;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface AuthUser {
  username: string;
  role: Role;
}

export interface Pipeline {
  id: number;
  name: string;
  repo_url: string;
  branch: string;

  // optionnels si vous les ajoutez/affichez plus tard
  docker_context?: string;
  dockerfile_path?: string;
  image_name?: string;
  deploy_host?: string;
  deploy_port?: number;
  deploy_user?: string;
  container_name?: string;
  host_port?: number;
  container_port?: number;
  healthcheck_url?: string;
}
