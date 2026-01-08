import { useEffect, useMemo, useState } from "react";
import type { User, Pipeline, RoleRequest } from "../types";
import { userAPI, pipelineAPI } from "../api";

export default function AdminPanel() {
  // -----------------------------
  // Users
  // -----------------------------
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"users" | "create" | "pipelines" | "requests">("users");

  // Update role
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<"viewer" | "dev" | "admin">("viewer");

  // Create user
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "dev" | "admin">("viewer");

  // -----------------------------
  // Pipelines
  // -----------------------------
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [runningPipelineId, setRunningPipelineId] = useState<number | null>(null);

  // -----------------------------
  // Role Requests
  // -----------------------------
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loading = loadingUsers || loadingPipelines || loadingRequests;

  // -----------------------------
  // Loaders
  // -----------------------------
  const loadUsers = async () => {
    try {
      const data = await userAPI.getAllUsers();
      setUsers(data);
    } catch (e: any) {
      console.error("Error loading users:", e);
      setError(e?.message || "Erreur lors du chargement des utilisateurs");
    }
  };

  const loadPipelines = async () => {
    try {
      const data = await pipelineAPI.getAllPipelines();
      setPipelines(data);
    } catch (e: any) {
      console.error("Error loading pipelines:", e);
      setError(e?.message || "Erreur lors du chargement des pipelines");
    }
  };

  const loadRoleRequests = async () => {
    try {
      const data = await userAPI.getAllRoleRequests();
      setRoleRequests(data);
    } catch (e: any) {
      console.error("Error loading role requests:", e);
      setError(e?.message || "Erreur lors du chargement des demandes de rôle");
    }
  };

  // Initial load
  useEffect(() => {
    loadUsers();
    loadPipelines();
    loadRoleRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Polling pipelines: refresh tant qu'il y a du pending/running
  const hasRunning = useMemo(() => {
    return pipelines.some((p) => ["pending", "running"].includes((p.status || "").toLowerCase()));
  }, [pipelines]);

  useEffect(() => {
    if (!hasRunning) return;

    const t = setInterval(() => {
      loadPipelines();
    }, 2000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRunning]);

  // ✅ Polling role requests
  useEffect(() => {
    const t = setInterval(() => {
      loadRoleRequests();
    }, 3000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Actions Users
  // -----------------------------
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Veuillez sélectionner un utilisateur");
      return;
    }

    setLoadingUsers(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.updateUserRole(selectedUserId, selectedRole);
      setSuccess(`Rôle mis à jour vers ${selectedRole}`);
      setSelectedUserId(null);
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la mise à jour du rôle");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setError("Le nom d'utilisateur est requis");
      return;
    }

    setLoadingUsers(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.createUser(newUsername, newRole, newEmail || undefined);
      setSuccess(`Utilisateur ${newUsername} créé avec succès`);
      setNewUsername("");
      setNewEmail("");
      setNewRole("viewer");
      await loadUsers();
      setActiveTab("users");
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la création de l'utilisateur");
    } finally {
      setLoadingUsers(false);
    }
  };

  // -----------------------------
  // Actions Pipelines
  // -----------------------------
  const handleRunPipeline = async (id: number) => {
    setLoadingPipelines(true);
    setRunningPipelineId(id);
    setError(null);
    setSuccess(null);

    try {
      await pipelineAPI.runPipeline(id);
      setSuccess("Pipeline lancé !");
      // refresh immédiat (et le polling prendra le relais)
      await loadPipelines();
    } catch (e: any) {
      setError(e?.message || "Erreur lors du lancement du pipeline");
    } finally {
      setLoadingPipelines(false);
      setRunningPipelineId(null);
    }
  };

  // -----------------------------
  // Actions Role Requests
  // -----------------------------
  const handleApproveRequest = async (requestId: number) => {
    setLoadingRequests(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.approveRoleRequest(requestId);
      setSuccess("Demande approuvée et rôle mis à jour");
      await loadRoleRequests();
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'approbation");
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    setLoadingRequests(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.rejectRoleRequest(requestId);
      setSuccess("Demande rejetée");
      await loadRoleRequests();
    } catch (e: any) {
      setError(e?.message || "Erreur lors du rejet");
    } finally {
      setLoadingRequests(false);
    }
  };

  // -----------------------------
  // UI helpers
  // -----------------------------
  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "dev":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "viewer":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusPill = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "success") return "bg-green-100 text-green-800 border-green-200";
    if (s === "failed" || s === "error") return "bg-red-100 text-red-800 border-red-200";
    if (s === "running") return "bg-blue-100 text-blue-800 border-blue-200";
    if (s === "pending") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Panneau d&apos;Administration</h2>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setError(null);
              setSuccess(null);
              loadUsers();
              loadPipelines();
              loadRoleRequests();
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("users")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "users"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Utilisateurs
          </button>

          <button
            onClick={() => setActiveTab("create")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "create"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Créer un utilisateur
          </button>

          <button
            onClick={() => setActiveTab("requests")}
            className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
              activeTab === "requests"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Demandes de rôle
            {roleRequests.filter((r) => r.status === "pending").length > 0 && (
              <span className="ml-2 inline-block bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {roleRequests.filter((r) => r.status === "pending").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("pipelines")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "pipelines"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Pipelines
          </button>
        </nav>
      </div>

      {/* USERS TAB */}
      {activeTab === "users" && (
        <>
          <form onSubmit={handleUpdateRole} className="mt-6 mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Attribuer un rôle</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Utilisateur</label>
                <select
                  value={selectedUserId || ""}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                >
                  <option value="viewer">Viewer</option>
                  <option value="dev">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  {loadingUsers ? "Mise à jour..." : "Mettre à jour"}
                </button>
              </div>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date de création</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{u.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(
                          u.role
                        )}`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(u.created_at).toLocaleDateString()}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CREATE TAB */}
      {activeTab === "create" && (
        <form onSubmit={handleCreateUser} className="mt-6 bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Créer un nouvel utilisateur</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom d&apos;utilisateur *</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="john_doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email (optionnel)</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">Si non fourni, un email sera généré: username@local</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rôle *</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                disabled={loading}
              >
                <option value="viewer">Viewer</option>
                <option value="dev">Developer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {loadingUsers ? "Création..." : "Créer l'utilisateur"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewUsername("");
                  setNewEmail("");
                  setNewRole("viewer");
                  setActiveTab("users");
                }}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}

      {/* REQUESTS TAB */}
      {activeTab === "requests" && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Demandes de promotion de rôle</h3>

          {roleRequests.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Aucune demande</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle actuel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle demandé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roleRequests.map((req) => {
                    const user = users.find((u) => u.id === req.user_id);
                    return (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user?.username || "Unknown"}</div>
                          <div className="text-xs text-gray-500">{user?.email || "N/A"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(
                              user?.role || "viewer"
                            )}`}
                          >
                            {(user?.role || "viewer").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(
                              req.requested_role
                            )}`}
                          >
                            {req.requested_role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRequestStatusColor(
                              req.status
                            )}`}
                          >
                            {req.status === "pending" ? "EN ATTENTE" : req.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{new Date(req.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {req.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveRequest(req.id)}
                                disabled={loadingRequests}
                                className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-lg disabled:opacity-50 text-xs"
                              >
                                Approuver
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={loadingRequests}
                                className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-lg disabled:opacity-50 text-xs"
                              >
                                Rejeter
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PIPELINES TAB */}
      {activeTab === "pipelines" && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-semibold text-gray-900">Pipelines</h3>
            <p className="text-sm text-gray-500">
              {hasRunning ? "Mise à jour auto (toutes les 2s)..." : "Stable"}
            </p>
          </div>

          {pipelines.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Aucun pipeline</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Repo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pipelines.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-blue-600 hover:underline">
                        <a href={p.github_url} target="_blank" rel="noopener noreferrer">
                          {p.github_url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.branch}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getStatusPill(
                            p.status
                          )}`}
                        >
                          {(p.status || "unknown").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleRunPipeline(p.id)}
                          disabled={loadingPipelines || (runningPipelineId === p.id)}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                        >
                          {runningPipelineId === p.id ? "Lancement..." : "Lancer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
