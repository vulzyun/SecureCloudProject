import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { authAPI } from "../api";
import type { User } from "../types";

interface AuthGuardProps {
  children: (user: User) => ReactNode;
  onForbidden: () => void;
}

export default function AuthGuard({ children, onForbidden }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // MODE DÉVELOPPEMENT : Simuler un utilisateur admin
      const DEV_MODE = false;
      
      if (DEV_MODE) {
        // Simuler un utilisateur admin pour tester l'interface
        setTimeout(() => {
          setUser({ 
            id: 1,
            email: "admin@test.com",
            username: "admin_test", 
            role: "admin",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          setLoading(false);
        }, 500);
        return;
      }

      try {
        // Cette API vérifie le header X-Auth-Request-User et crée l'utilisateur si nécessaire
        const currentUser = await authAPI.getCurrentUser();
        setUser(currentUser);
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
