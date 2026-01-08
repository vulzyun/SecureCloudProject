import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User, Pipeline } from "../types";
import { pipelineAPI } from "../api";
import AdminPanel from "../components/AdminPanel";
import RoleRequestPanel from "../components/RoleRequestPanel";

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [branch, setBranch] = useState("main");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isViewer = user.role === "viewer";
  const isDev = user.role === "dev";
  const isAdmin = user.role === "admin";

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      const data = await pipelineAPI.getAllPipelines();
      setPipelines(data);
    } catch (err) {
      console.error("Error loading pipelines:", err);
    }
  };

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || !pipelineName.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await pipelineAPI.createPipeline(pipelineName, repoUrl, branch);
      setSuccess("Pipeline créé avec succès !");
      setRepoUrl("");
      setPipelineName("");
      setBranch("main");
      await loadPipelines();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création du pipeline");
    } finally {
      setLoading(false);
    }
  };

  const handleRunPipeline = async (id: number) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await pipelineAPI.runPipeline(id);
      setSuccess("Pipeline lancé avec succès !");
      await loadPipelines();
    } catch (err: any) {
      setError(err.message || "Erreur lors du lancement du pipeline");
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

  const handleRoleRequestSuccess = () => {
    // Reload user info if needed - in real app, you'd fetch updated user
    // For now, just show success message
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SecureCloud Pipeline</h1>
              <p className="text-sm text-gray-500 mt-1">Gestion des pipelines CI/CD</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.username}</p>
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(user.role)}`}>
                {user.role.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Role Request Panel for non-admin users */}
        {!isAdmin && <RoleRequestPanel user={user} onSuccess={handleRoleRequestSuccess} />}

        {isViewer && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Accès lecture seule</h3>
            <p className="text-yellow-700 text-sm">
              Vous pouvez consulter les pipelines, mais pas créer/lancer. 
              Demandez une promotion vers le rôle Developer ci-dessus.
            </p>
          </div>
        )}

        {/* Admin Panel */}
        {isAdmin && <AdminPanel />}

        {(isDev || isAdmin) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Créer un nouveau pipeline</h2>
            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom du Pipeline</label>
                <input
                  type="text"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">URL GitHub</label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
              >
                {loading ? "Création..." : "Create Pipeline"}
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pipelines</h2>

          {pipelines.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucun pipeline pour le moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL GitHub</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé par</th>
                    {(isDev || isAdmin) && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voir les logs</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{p.created_by || "N/A"}</td>
                      {(isDev || isAdmin) && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleRunPipeline(p.id)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                          >
                            Lancer
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/logs/${p.id}`)}
                          className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-lg"
                        >
                         Voir les logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
