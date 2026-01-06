import { useState, useEffect } from "react";
import type { User, RoleChangeRequest } from "../types";
import { userAPI } from "../api";

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [selectedRole, setSelectedRole] = useState<"viewer" | "contributor" | "admin">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "requests">("users");

  useEffect(() => {
    loadUsers();
    loadRoleRequests();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userAPI.getAllUsers();
      setUsers(data);
    } catch (err: any) {
      console.error("Error loading users:", err);
    }
  };

  const loadRoleRequests = async () => {
    try {
      const data = await userAPI.getRoleRequests();
      setRoleRequests(data.filter((r) => r.status === "pending"));
    } catch (err: any) {
      console.error("Error loading role requests:", err);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUsername.trim()) {
      setError("Veuillez entrer un nom d'utilisateur");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.updateUserRole(selectedUsername, selectedRole);
      setSuccess(`Rôle de ${selectedUsername} mis à jour vers ${selectedRole}`);
      setSelectedUsername("");
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du rôle");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = async (requestId: number, approved: boolean) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.reviewRoleRequest(requestId, approved);
      setSuccess(`Demande ${approved ? "approuvée" : "rejetée"} avec succès`);
      loadRoleRequests();
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Erreur lors du traitement de la demande");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "contributor":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "viewer":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center mb-6">
        <svg
          className="w-6 h-6 text-red-600 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
          />
        </svg>
        <h2 className="text-xl font-bold text-gray-900">Panneau d'Administration</h2>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("users")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "users"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Gestion des utilisateurs
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`py-4 px-1 border-b-2 font-medium text-sm relative ${
              activeTab === "requests"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Demandes de rôle
            {roleRequests.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {roleRequests.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Users Tab */}
      {activeTab === "users" && (
        <>
          {/* Update Role Form */}
          <form onSubmit={handleUpdateRole} className="mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Attribuer un rôle</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  id="username"
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle
                </label>
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="viewer">Viewer</option>
                  <option value="contributor">Contributor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Mise à jour..." : "Mettre à jour"}
                </button>
              </div>
            </div>
          </form>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Role Requests Tab */}
      {activeTab === "requests" && (
        <div>
          {roleRequests.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-4 text-gray-500">Aucune demande en attente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {roleRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {request.username}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Demande le rôle:{" "}
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${getRoleColor(
                            request.requested_role
                          )}`}
                        >
                          {request.requested_role.toUpperCase()}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleReviewRequest(request.id, true)}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Approuver
                      </button>
                      <button
                        onClick={() => handleReviewRequest(request.id, false)}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
