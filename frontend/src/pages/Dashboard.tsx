import { useState, useEffect } from "react";
import { AuthUser, Pipeline } from "../types";
import { pipelineAPI, userAPI } from "../api";
import AdminPanel from "../components/AdminPanel";

interface DashboardProps {
  user: AuthUser;
}

export default function Dashboard({ user }: DashboardProps) {
  const [githubUrl, setGithubUrl] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isViewer = user.role === "viewer";
  const isContributor = user.role === "contributor";
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
    if (!githubUrl.trim() || !pipelineName.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await pipelineAPI.createPipeline(githubUrl, pipelineName);
      setSuccess("Pipeline créé avec succès !");
      setGithubUrl("");
      setPipelineName("");
      loadPipelines();
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
      loadPipelines();
    } catch (err: any) {
      setError(err.message || "Erreur lors du lancement du pipeline");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRoleChange = async () => {
    if (!window.confirm("Voulez-vous demander à devenir contributeur ?")) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await userAPI.requestRoleChange("contributor");
      setSuccess("Demande de changement de rôle envoyée aux administrateurs !");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi de la demande");
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SecureCloud Pipeline</h1>
              <p className="text-sm text-gray-500 mt-1">Gestion des pipelines CI/CD</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                <span
                  className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${getRoleColor(
                    user.role
                  )}`}
                >
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
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

        {/* Viewer Alert */}
        {isViewer && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start">
              <svg
                className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 mb-2">Accès limité</h3>
                <p className="text-yellow-700 text-sm mb-4">
                  Vous avez actuellement un accès en lecture seule. Pour créer et lancer des pipelines,
                  demandez le rôle de contributeur.
                </p>
                <button
                  onClick={handleRequestRoleChange}
                  disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Demander le rôle Contributeur
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Pipeline Form */}
        {(isContributor || isAdmin) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Créer un nouveau pipeline</h2>
            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div>
                <label htmlFor="pipelineName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du Pipeline
                </label>
                <input
                  type="text"
                  id="pipelineName"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="Ex: mon-projet-backend"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="githubUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  URL GitHub
                </label>
                <input
                  type="url"
                  id="githubUrl"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Création...
                  </>
                ) : (
                  "Create Pipeline"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Admin Panel */}
        {isAdmin && <AdminPanel />}

        {/* Pipelines List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pipelines</h2>
          {pipelines.length === 0 ? (
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
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="mt-4 text-gray-500">Aucun pipeline pour le moment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL GitHub
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Créé par
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    {(isContributor || isAdmin) && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pipelines.map((pipeline) => (
                    <tr key={pipeline.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{pipeline.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={pipeline.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {pipeline.github_url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(
                            pipeline.status
                          )}`}
                        >
                          {pipeline.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pipeline.created_by}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(pipeline.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      {(isContributor || isAdmin) && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleRunPipeline(pipeline.id)}
                            disabled={loading || pipeline.status === "running"}
                            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Lancer
                          </button>
                        </td>
                      )}
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
