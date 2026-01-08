export type Role = "viewer" | "dev" | "admin";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface User {
  id: number;
  email: string;
  username: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface RoleRequest {
  id: number;
  user_id: number;
  requested_role: Role;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: number;
  name: string;
  repo_url: string;
  github_url: string;
  branch: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RunEvent {
  type: "log" | "step_start" | "step_success" | "run_start" | "run_success" | "run_failed";
  step?: string;
  message?: string;
}
