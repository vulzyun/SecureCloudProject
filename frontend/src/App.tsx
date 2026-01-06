import Login from "./pages/Login";
import Pipelines from "./pages/Pipelines";
import Run from "./pages/Run";

export default function App() {
  const path = window.location.pathname;

  if (path === "/") return <Login />;
  if (path === "/pipelines") return <Pipelines />;
  if (path.startsWith("/runs/")) return <Run runId={path.split("/")[2]} />;
  return <div style={{ padding: 24 }}>404</div>;
}

