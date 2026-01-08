import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";
import Run from "./pages/Run";
import LogViewer from "./pages/LogViewer";

function RunRoute() {
  const { runId } = useParams();
  if (!runId) return <Navigate to="/" replace />;
  return <Run runId={runId} />;
}

export default function App() {
  const [isForbidden, setIsForbidden] = useState(false);

  if (isForbidden) return <Forbidden />;

  return (
    <BrowserRouter>
      <AuthGuard onForbidden={() => setIsForbidden(true)}>
        {(user) => (
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/runs/:runId" element={<RunRoute />} />
            <Route path="/logs/:pipelineId" element={<LogViewer />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </AuthGuard>
    </BrowserRouter>
  );
}
