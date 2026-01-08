import { useEffect, useState } from "react";
import type { User, RoleRequest } from "../types";
import { userAPI } from "../api";

interface RoleRequestPanelProps {
  user: User;
  onSuccess?: () => void;
}

export default function RoleRequestPanel({ user, onSuccess }: RoleRequestPanelProps) {
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [myRequests, setMyRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = user.role === "admin";

  // Charger les rôles disponibles et les demandes
  useEffect(() => {
    if (!isAdmin) {
      loadAvailableRoles();
      loadMyRequests();
    }
  }, [isAdmin]);

  const loadAvailableRoles = async () => {
    try {
      const roles = await userAPI.getAvailableRoles();
      setAvailableRoles(roles);
      if (roles.length > 0) {
        setSelectedRole(roles[0]);
      }
    } catch (e: any) {
      console.error("Error loading available roles:", e);
    }
  };

  const loadMyRequests = async () => {
    try {
      const requests = await userAPI.getMyRequests();
      setMyRequests(requests);
    } catch (e: any) {
      console.error("Error loading requests:", e);
    }
  };

  const handleRequestRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError("Veuillez sélectionner un rôle");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.requestRole(selectedRole);
      setSuccess(`Demande de promotion vers ${selectedRole} envoyée !`);
      setSelectedRole("");
      await loadMyRequests();
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message || "Erreur lors de la demande");
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

  // Les admins ne peuvent pas demander de promotion
  if (isAdmin) {
    return null;
  }

  // Si aucun rôle n'est disponible (l'utilisateur est au maximum)
  if (availableRoles.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Demandes de promotion</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            Vous avez déjà le rôle maximum. Aucune promotion supplémentaire n'est disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Demandes de promotion de rôle</h2>

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

      <form onSubmit={handleRequestRole} className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800 text-sm">
            Votre rôle actuel : <span className="font-semibold">{user.role.toUpperCase()}</span>
          </p>
          <p className="text-blue-700 text-sm mt-2">
            Demandez une promotion ! Un administrateur devra approuver votre demande.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rôle demandé</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              disabled={loading}
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={loading || availableRoles.length === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {loading ? "Envoi en cours..." : "Demander une promotion"}
            </button>
          </div>
        </div>
      </form>

      {/* Afficher les demandes précédentes */}
      {myRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Historique de vos demandes</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle demandé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
