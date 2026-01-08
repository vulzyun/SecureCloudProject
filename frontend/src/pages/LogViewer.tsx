import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { runAPI } from "../api";

export default function LogViewer() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    if (!pipelineId) return;
    
    setLoading(true);
    setError(null);
    try {
      const content = await runAPI.getLogs(Number(pipelineId));
      setLogs(content);
    } catch (e: any) {
      setError(e.message || "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pipelineId]);

  // Auto-refresh every 2 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, pipelineId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                📄 Logs du Pipeline #{pipelineId}
              </h1>
              <p className="text-gray-600 mt-1">
                Fichier : ~/.cicd/workspaces/[pipeline-name]/logs/[pipeline-name].log
              </p>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                Auto-refresh (2s)
              </label>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {loading ? "⟳ Chargement..." : "🔄 Rafraîchir"}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg"
              >
                ← Retour
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-4 mb-6">
            <strong>Erreur :</strong> {error}
          </div>
        )}

        {/* Logs Display */}
        <div className="bg-gray-900 rounded-lg shadow-lg p-6">
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
            {logs || (loading ? "Chargement des logs..." : "Aucun log disponible")}
          </pre>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow-md p-4 mt-6 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Lignes : {logs.split('\n').length}</span>
            <span>Caractères : {logs.length}</span>
            <span>Dernière mise à jour : {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
