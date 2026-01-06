export type Role = "viewer" | "contributor" | "admin";

export interface User {
  id: number;
  username: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: number;
  name: string;
  github_url: string;
  status: "pending" | "running" | "completed" | "failed";
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RoleChangeRequest {
  id: number;
  username: string;
  requested_role: Role;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface AuthUser {
  username: string;
  role: Role;
}
