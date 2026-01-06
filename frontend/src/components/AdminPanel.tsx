import { useEffect, useState } from "react";
import type { Role, RoleChangeRequest, User } from "../types";
import { userAPI } from "../api";

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedUsername, setSelectedUsername] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("viewer");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refreshAll() {
    setError(null);
    try {
      const [u, reqs] = await Promise.all([
        userAPI.getAllUsers(),
        userAPI.getRoleRequests(),
      ]);
      setUsers(u);
      // on garde seulement pending côté UI
      setRoleRequests(reqs.filter((r: RoleChangeRequest) => r.status === "pending"));
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function onUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedUsername.trim()) {
      setError("Veuillez saisir un username.");
      return;
    }

    setLoading(true);
    try {
      await userAPI.updateUserRole(selectedUsername.trim(), selectedRole);
      setSuccess(`Rôle mis à jour: ${selectedUsername} -> ${selectedRole}`);
      setSelectedUsername("");
      await refreshAll();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
        <button
          onClick={refreshAll}
          className="text-sm px-3 py-2 rounded border hover:bg-gray-50"
          disabled={loading}
        >
          Rafraîchir
        </button>
      </div>

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

      {/* Update user role */}
      <form onSubmit={onUpdateRole} className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Changer le rôle d’un utilisateur</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              value={selectedUsername}
              onChange={(e) => setSelectedUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="ex: youri"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              disabled={loading}
            >
              <option value="viewer">viewer</option>
              <option value="contributor">contributor</option>
              <option value="admin">admin</option>
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

      {/* Users list */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">Utilisateurs</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {u.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={3}>
                    Aucun utilisateur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role requests list (read-only for now) */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Demandes de rôle (pending)</h3>
        {roleRequests.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-3">
            {roleRequests.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{r.username}</div>
                    <div className="text-sm text-gray-700">
                      Demande: <b>{r.requested_role}</b>
                    </div>
                    {r.message && (
                      <div className="text-sm text-gray-600 mt-1">
                        Message: {r.message}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  (Validation/rejet à ajouter quand on implémente l’endpoint admin review)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

