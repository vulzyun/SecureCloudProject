import { ReactNode, useEffect, useState } from "react";
import { authAPI } from "../api";
import type { AuthUser } from "../types";

interface AuthGuardProps {
  children: (user: AuthUser) => ReactNode;
  onForbidden: () => void;
}

export default function AuthGuard({ children, onForbidden }: AuthGuardProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // MODE DÉVELOPPEMENT : Simuler un utilisateur admin
      const DEV_MODE = true;
      
      if (DEV_MODE) {
        // Simuler un utilisateur admin pour tester l'interface
        setTimeout(() => {
          setUser({ username: "admin_test", role: "admin" });
          setLoading(false);
        }, 500);
        return;
      }

      try {
        // Cette API vérifie le header X-Auth-Request-User et crée l'utilisateur si nécessaire
        const currentUser = await authAPI.checkOrCreateUser();
        setUser({ username: currentUser.username, role: currentUser.role });
        setLoading(false);
      } catch (err) {
        console.error("Auth error:", err);
        setError(true);
        setLoading(false);
        onForbidden();
      }
    };

    checkAuth();
  }, [onForbidden]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return null; // La redirection est gérée par onForbidden
  }

  return <>{children(user)}</>;
}
