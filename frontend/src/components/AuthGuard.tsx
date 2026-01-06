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

  useEffect(() => {
    const check = async () => {
      // DEV MODE : Si on n'est PAS sur le port 4180 (oauth2-proxy)
      const isOAuth2Proxy = window.location.port === "4180";
      const DEV_MODE = !isOAuth2Proxy;
      
      if (DEV_MODE) {
        // Mode développement : simuler un utilisateur admin
        setUser({ 
          id: 1, 
          email: "admin@test.com", 
          username: "admin_test", 
          role: "admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setLoading(false);
        return;
      }

      // Mode production avec oauth2-proxy : récupérer l'utilisateur réel
      try {
        const me = await authAPI.getCurrentUser();
        setUser(me);
      } catch (e) {
        onForbidden();
      } finally {
        setLoading(false);
      }
    };

    check();
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

  if (!user) return null;
  return <>{children(user)}</>;
}
