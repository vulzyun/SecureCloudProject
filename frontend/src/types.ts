export type Role = "viewer" | "dev" | "admin";

export interface User {
  id: number;
  email: string;
  username: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: number;
  name: string;
  repo_url: string;
  github_url: string;
  branch: string;
  status: "pending" | "running" | "completed" | "failed";
  created_by: string;
  created_at: string;
  updated_at: string;
}
