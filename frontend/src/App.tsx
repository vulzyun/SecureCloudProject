import { useState } from "react";
import AuthGuard from "./components/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Forbidden from "./pages/Forbidden";

export default function App() {
  const [isForbidden, setIsForbidden] = useState(false);

  if (isForbidden) {
    return <Forbidden />;
  }

  return (
    <AuthGuard onForbidden={() => setIsForbidden(true)}>
      {(user) => <Dashboard user={user} />}
    </AuthGuard>
  );
}


