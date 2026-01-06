import { useEffect, useState } from "react";
import type { User } from "../types";
import { userAPI } from "../api";

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "create">("users");

  // Pour mise à jour de rôle
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<"viewer" | "dev" | "admin">("viewer");

  // Pour création d'utilisateur
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "dev" | "admin">("viewer");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userAPI.getAllUsers();
      setUsers(data);
    } catch (e: any) {
      console.error("Error loading users:", e);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Veuillez sélectionner un utilisateur");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.updateUserRole(selectedUserId, selectedRole);
      setSuccess(`Rôle mis à jour vers ${selectedRole}`);
      setSelectedUserId(null);
      loadUsers();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la mise à jour du rôle");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setError("Le nom d'utilisateur est requis");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.createUser(newUsername, newRole, newEmail || undefined);
      setSuccess(`Utilisateur ${newUsername} créé avec succès`);
      setNewUsername("");
      setNewEmail("");
      setNewRole("viewer");
      loadUsers();
      setActiveTab("users");
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la création de l'utilisateur");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Panneau d'Administration</h2>

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
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Gestion des utilisateurs
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Utilisateur
                </label>
                <select
                  value={selectedUserId || ""}
                  onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle
                </label>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(user.role)}`}>
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

      {/* Create User Tab */}
      {activeTab === "create" && (
        <form onSubmit={handleCreateUser} className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Créer un nouvel utilisateur</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom d'utilisateur *
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (optionnel)
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Si non fourni, un email sera généré: username@local
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rôle *
              </label>
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
                {loading ? "Création..." : "Créer l'utilisateur"}
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
    </div>
  );
}
